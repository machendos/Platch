import { ChainNode, MoveRequest, planChainWrites } from './chain.writes';
import { ProjectStatus } from './chain.writes';

type Seed = {
  id: string;
  parent?: string | null;
  prev?: string | null;
  status?: ProjectStatus;
};

const node = ({
  id,
  parent = null,
  prev = null,
  status = 'ACTIVE',
}: Seed): ChainNode => ({
  id,
  parentProjectId: parent,
  projectStatus: status,
  prevProjectIdInHierarchy: prev,
});

/* Replays a plan the way the service does — nulls then links — and fails the
   moment a write would collide with the unique index, which is the whole
   reason the ordering exists. */
const apply = (projects: ChainNode[], move: MoveRequest) => {
  const plan = planChainWrites(projects, move);
  const state = new Map(projects.map((p) => [p.id, { ...p }]));

  if (plan.statusChange) {
    for (const id of plan.statusChange.ids) {
      (state.get(id) as ChainNode).projectStatus =
        plan.statusChange.projectStatus;
    }
  }

  for (const write of plan.writes) {
    const row = state.get(write.id) as ChainNode;

    if (write.prevProjectIdInHierarchy !== null) {
      const claimant = [...state.values()].find(
        (other) =>
          other.id !== write.id &&
          other.prevProjectIdInHierarchy === write.prevProjectIdInHierarchy,
      );
      if (claimant) {
        throw new Error(
          `unique violation: ${write.id} and ${claimant.id} both claim ${write.prevProjectIdInHierarchy}`,
        );
      }
    }

    row.prevProjectIdInHierarchy = write.prevProjectIdInHierarchy;
    if (write.parentProjectId !== undefined) {
      row.parentProjectId = write.parentProjectId;
    }
  }

  return [...state.values()];
};

/* The rendered order of one (parent, status) group, walked from its head. */
const chain = (
  state: ChainNode[],
  parent: string | null,
  status: ProjectStatus = 'ACTIVE',
) => {
  const members = state.filter(
    (p) => p.parentProjectId === parent && p.projectStatus === status,
  );
  const heads = members.filter((m) => m.prevProjectIdInHierarchy === null);
  expect(heads).toHaveLength(members.length === 0 ? 0 : 1);

  const order: string[] = [];
  let current = heads[0];
  while (current) {
    order.push(current.id);
    current = members.find(
      (m) => m.prevProjectIdInHierarchy === current.id,
    ) as ChainNode;
  }

  expect(order).toHaveLength(members.length);
  return order;
};

describe('planChainWrites', () => {
  describe('reordering within one chain', () => {
    const list = [
      node({ id: 'a' }),
      node({ id: 'b', prev: 'a' }),
      node({ id: 'c', prev: 'b' }),
      node({ id: 'd', prev: 'c' }),
    ];

    it('moves a project down the list', () => {
      const after = apply(list, {
        id: 'b',
        parentProjectId: null,
        prevProjectIdInHierarchy: 'c',
      });

      expect(chain(after, null)).toEqual(['a', 'c', 'b', 'd']);
    });

    it('moves a project up the list', () => {
      const after = apply(list, {
        id: 'd',
        parentProjectId: null,
        prevProjectIdInHierarchy: 'a',
      });

      expect(chain(after, null)).toEqual(['a', 'd', 'b', 'c']);
    });

    it('moves a project to the head', () => {
      const after = apply(list, {
        id: 'c',
        parentProjectId: null,
        prevProjectIdInHierarchy: null,
      });

      expect(chain(after, null)).toEqual(['c', 'a', 'b', 'd']);
    });

    it('leaves the list alone when the position does not change', () => {
      const plan = planChainWrites(list, {
        id: 'b',
        parentProjectId: null,
        prevProjectIdInHierarchy: 'a',
      });

      expect(plan.writes).toEqual([]);
      expect(plan.statusChange).toBeNull();
    });

    /* The point of the two-phase ordering: a naive plan would assign a
       predecessor another row still holds. */
    it('never assigns a predecessor another row still claims', () => {
      expect(() =>
        apply(list, {
          id: 'b',
          parentProjectId: null,
          prevProjectIdInHierarchy: 'c',
        }),
      ).not.toThrow();
    });
  });

  describe('reparenting', () => {
    const tree = [
      node({ id: 'sport' }),
      node({ id: 'workout', parent: 'sport' }),
      node({ id: 'legs', parent: 'workout' }),
      node({ id: 'errands', prev: 'sport' }),
    ];

    it('closes the gap the project left behind', () => {
      const after = apply(tree, {
        id: 'workout',
        parentProjectId: null,
        prevProjectIdInHierarchy: 'sport',
      });

      expect(chain(after, null)).toEqual(['sport', 'workout', 'errands']);
      expect(chain(after, 'sport')).toEqual([]);
    });

    it('takes the subtree along', () => {
      const after = apply(tree, {
        id: 'workout',
        parentProjectId: null,
        prevProjectIdInHierarchy: 'sport',
      });

      expect(after.find((p) => p.id === 'legs')?.parentProjectId).toBe(
        'workout',
      );
    });

    it('refuses to move a project inside its own subtree', () => {
      expect(() =>
        planChainWrites(tree, {
          id: 'sport',
          parentProjectId: 'legs',
          prevProjectIdInHierarchy: null,
        }),
      ).toThrow(/inside itself/);
    });

    it('refuses to move a project under itself', () => {
      expect(() =>
        planChainWrites(tree, {
          id: 'sport',
          parentProjectId: 'sport',
          prevProjectIdInHierarchy: null,
        }),
      ).toThrow(/inside itself/);
    });

    it('refuses a destination in a different list', () => {
      expect(() =>
        planChainWrites(tree, {
          id: 'errands',
          parentProjectId: null,
          prevProjectIdInHierarchy: 'legs',
        }),
      ).toThrow(/not in the destination list/);
    });

    it('refuses a parent that does not exist', () => {
      expect(() =>
        planChainWrites(tree, {
          id: 'errands',
          parentProjectId: 'ghost',
          prevProjectIdInHierarchy: null,
        }),
      ).toThrow(/new parent does not exist/);
    });
  });

  describe('crossing sections', () => {
    it('carries the whole subtree across', () => {
      const tree = [
        node({ id: 'sport' }),
        node({ id: 'workout', parent: 'sport' }),
        node({ id: 'legs', parent: 'workout' }),
      ];

      const plan = planChainWrites(tree, {
        id: 'workout',
        parentProjectId: 'sport',
        prevProjectIdInHierarchy: null,
        projectStatus: 'BACKLOG',
      });

      expect(plan.statusChange?.projectStatus).toBe('BACKLOG');
      expect(plan.statusChange?.ids.sort()).toEqual(['legs', 'workout']);
    });

    it('reports no status change when the section is unchanged', () => {
      const plan = planChainWrites([node({ id: 'a' })], {
        id: 'a',
        parentProjectId: null,
        prevProjectIdInHierarchy: null,
        projectStatus: 'ACTIVE',
      });

      expect(plan.statusChange).toBeNull();
    });

    /* The case from docs: a parent with children in both sections. Flipping the
       subtree merges two valid chains into one group, leaving two null heads —
       which nothing rejects and the renderer silently reorders by id. */
    it('splices the two chains a merged group would otherwise have', () => {
      const tree = [
        node({ id: 'workout' }),
        node({ id: 'legs', parent: 'workout' }),
        node({ id: 'shoulders', parent: 'workout', prev: 'legs' }),
        node({ id: 'arms', parent: 'workout', status: 'BACKLOG' }),
        node({ id: 'abs', parent: 'workout', prev: 'arms', status: 'BACKLOG' }),
      ];

      const after = apply(tree, {
        id: 'workout',
        parentProjectId: null,
        prevProjectIdInHierarchy: null,
        projectStatus: 'BACKLOG',
      });

      /* chain() asserts exactly one head, which is what the splice restores.
         The section keeps the order it already had and the arriving pair is
         appended, rather than the two interleaving by an id tiebreak. */
      expect(chain(after, 'workout', 'BACKLOG')).toEqual([
        'arms',
        'abs',
        'legs',
        'shoulders',
      ]);
      expect(after.filter((p) => p.projectStatus === 'ACTIVE')).toEqual([]);
    });

    /* A subtree that already straddles both sections. The child that was
       already in the destination did not arrive with the move, so it keeps
       its place at the front and the two that did are appended. */
    it('keeps a descendant that was already in the destination ahead of the arrivals', () => {
      const tree = [
        node({ id: 'workout' }),
        node({ id: 'cardio', parent: 'workout' }),
        node({ id: 'stretching', parent: 'workout', prev: 'cardio' }),
        node({ id: 'legs', parent: 'workout', status: 'BACKLOG' }),
      ];

      const after = apply(tree, {
        id: 'workout',
        parentProjectId: null,
        prevProjectIdInHierarchy: null,
        projectStatus: 'BACKLOG',
      });

      expect(chain(after, 'workout', 'BACKLOG')).toEqual([
        'legs',
        'cardio',
        'stretching',
      ]);
    });
  });

  describe('corrupt input still produces a legal plan', () => {
    it('gives a group with no head exactly one afterwards', () => {
      const cycle = [
        node({ id: 'a', prev: 'b' }),
        node({ id: 'b', prev: 'a' }),
        node({ id: 'c' }),
      ];

      const after = apply(cycle, {
        id: 'c',
        parentProjectId: null,
        prevProjectIdInHierarchy: 'a',
      });

      expect(chain(after, null)).toHaveLength(3);
    });

    it('collapses several heads into one chain', () => {
      const heads = [node({ id: 'a' }), node({ id: 'b' }), node({ id: 'c' })];

      const after = apply(heads, {
        id: 'c',
        parentProjectId: null,
        prevProjectIdInHierarchy: 'a',
      });

      expect(chain(after, null)).toEqual(['a', 'c', 'b']);
    });
  });
});
