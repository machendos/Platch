import { describe, expect, it } from 'vitest';
import type { ProjectWithTimeSlots } from '../../../../api/structures/ProjectWithTimeSlots';
import type { ProjectStatus } from './projectTree';
import { buildSectionRows, maxDepth } from './projectTree';

type Seed = {
  id: string;
  parent?: string | null;
  prev?: string | null;
  status?: ProjectStatus;
};

const project = ({
  id,
  parent = null,
  prev = null,
  status = 'ACTIVE',
}: Seed): ProjectWithTimeSlots => ({
  timeComponents: [],
  color: null,
  name: id,
  id,
  goal: null,
  context: null,
  timeNeededMinutes: null,
  minBlockMinutes: null,
  repetitionsNeeded: null,
  earliestDate: null,
  earliestTime: null,
  deadlineDate: null,
  deadlineTime: null,
  projectStatus: status,
  flexibleTimezone: false,
  originalTimezone: null,
  parentProjectId: parent,
  colorId: null,
  prevProjectIdInHierarchy: prev,
  userId: 'user',
});

const build = (seeds: Seed[], status: ProjectStatus = 'ACTIVE') =>
  buildSectionRows(seeds.map(project), status);

const ids = (seeds: Seed[], status: ProjectStatus = 'ACTIVE') =>
  build(seeds, status).map((row) => row.project.id);

describe('order within a chain', () => {
  it('follows the prev pointers rather than the input order', () => {
    expect(
      ids([{ id: 'c', prev: 'b' }, { id: 'a' }, { id: 'b', prev: 'a' }]),
    ).toEqual(['a', 'b', 'c']);
  });

  it('renders a single project', () => {
    expect(ids([{ id: 'only' }])).toEqual(['only']);
  });

  it('renders nothing when the section is empty', () => {
    expect(ids([{ id: 'a', status: 'BACKLOG' }])).toEqual([]);
  });
});

describe('corrupt chains still render', () => {
  it('takes the lowest id as the head when no project claims null', () => {
    expect(
      ids([
        { id: 'b', prev: 'c' },
        { id: 'c', prev: 'b' },
      ]),
    ).toEqual(['b', 'c']);
  });

  it('runs several null heads one after another, in id order', () => {
    expect(
      ids([
        { id: 'b' },
        { id: 'b2', prev: 'b' },
        { id: 'a' },
        { id: 'a2', prev: 'a' },
      ]),
    ).toEqual(['a', 'a2', 'b', 'b2']);
  });

  it('cuts a cycle instead of looping forever', () => {
    const rows = ids([
      { id: 'a' },
      { id: 'b', prev: 'a' },
      { id: 'c', prev: 'd' },
      { id: 'd', prev: 'c' },
    ]);
    expect(rows).toHaveLength(4);
    expect(rows.slice(0, 2)).toEqual(['a', 'b']);
    expect(rows.slice(2).sort()).toEqual(['c', 'd']);
  });

  it('treats a parent that does not exist as a root', () => {
    expect(ids([{ id: 'orphan', parent: 'missing' }])).toEqual(['orphan']);
    expect(build([{ id: 'orphan', parent: 'missing' }])[0].depth).toBe(0);
  });

  it('treats a project that parents itself as a root', () => {
    expect(build([{ id: 'loop', parent: 'loop' }])[0].depth).toBe(0);
  });

  it('ignores a prev pointer aimed outside the sibling group', () => {
    expect(
      ids([
        { id: 'parent' },
        { id: 'child', parent: 'parent', prev: 'parent' },
      ]),
    ).toEqual(['parent', 'child']);
  });
});

describe('hierarchy', () => {
  const tree: Seed[] = [
    { id: 'sport' },
    { id: 'workout', parent: 'sport' },
    { id: 'legs', parent: 'workout' },
  ];

  it('indents by ancestry length, with no cap', () => {
    expect(build(tree).map((row) => row.depth)).toEqual([0, 1, 2]);
    expect(maxDepth(build(tree))).toBe(2);
  });

  it('walks depth first', () => {
    expect(
      ids([
        { id: 'a' },
        { id: 'a-child', parent: 'a' },
        { id: 'b', prev: 'a' },
      ]),
    ).toEqual(['a', 'a-child', 'b']);
  });

  it('flags only the nodes that render children', () => {
    expect(build(tree).map((row) => row.hasChildren)).toEqual([
      true,
      true,
      false,
    ]);
  });
});

describe('spines', () => {
  const split: Seed[] = [
    { id: 'sport' },
    { id: 'workout', parent: 'sport' },
    { id: 'legs', parent: 'workout', status: 'BACKLOG' },
  ];

  it('draws the ancestors of a moved project in the other section', () => {
    expect(ids(split, 'BACKLOG')).toEqual(['sport', 'workout', 'legs']);
  });

  it('marks those ancestors as spines and the project itself as real', () => {
    expect(build(split, 'BACKLOG').map((row) => row.isSpine)).toEqual([
      true,
      true,
      false,
    ]);
  });

  it('leaves the ancestors real in their own section', () => {
    const rows = build(split, 'ACTIVE');
    expect(rows.map((row) => row.project.id)).toEqual(['sport', 'workout']);
    expect(rows.every((row) => row.isSpine)).toBe(false);
  });

  it('omits a branch with nothing of this section under it', () => {
    expect(ids([...split, { id: 'unrelated' }], 'BACKLOG')).not.toContain(
      'unrelated',
    );
  });

  it('emits members before spines under the same parent', () => {
    expect(
      ids(
        [
          { id: 'workout' },
          { id: 'arms', parent: 'workout', status: 'BACKLOG' },
          { id: 'legs', parent: 'workout' },
          { id: 'shin', parent: 'legs', status: 'BACKLOG' },
        ],
        'BACKLOG',
      ),
    ).toEqual(['workout', 'arms', 'legs', 'shin']);
  });

  it('stops drawing a spine once its last descendant leaves', () => {
    const returned = split.map((seed) =>
      seed.id === 'legs' ? { ...seed, status: 'ACTIVE' as const } : seed,
    );
    expect(ids(returned, 'BACKLOG')).toEqual([]);
  });
});

describe('collapsing', () => {
  const tree = [
    { id: 'sport' },
    { id: 'workout', parent: 'sport' },
    { id: 'legs', parent: 'workout' },
  ].map(project);

  it('hides the whole subtree under a collapsed node', () => {
    const rows = buildSectionRows(tree, 'ACTIVE', {
      collapsedIds: new Set(['workout']),
    });
    expect(rows.map((row) => row.project.id)).toEqual(['sport', 'workout']);
  });

  it('keeps the chevron on a collapsed node that still has children', () => {
    const rows = buildSectionRows(tree, 'ACTIVE', {
      collapsedIds: new Set(['workout']),
    });
    expect(rows[1].hasChildren).toBe(true);
  });
});
