import { describe, expect, it } from 'vitest';
import { generateNKeysBetween } from 'fractional-indexing';
import type { ProjectWithTimeSlots } from '../../../../api/structures/ProjectWithTimeSlots';
import type { ProjectStatus } from './projectTree';
import { buildSectionRows } from './projectTree';

type Seed = {
  id: string;
  parent?: string | null;
  position?: string;
  status?: ProjectStatus;
  color?: string | null;
};

const makeProject = ({
  id,
  parent = null,
  position = 'a0',
  status = 'ACTIVE',
  color = null,
}: Seed): ProjectWithTimeSlots => ({
  timeComponents: [],
  color: color === null ? null : { id: color, placement: 1, hexCode: color },
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
  position,
  userId: 'user',
});

/* Seeds get ascending keys in the order they are written, so a test only
   spells a position out when the point is that it disagrees with that order. */
const buildRows = (seeds: Seed[], status: ProjectStatus = 'ACTIVE') => {
  const keys = generateNKeysBetween(null, null, seeds.length);

  return buildSectionRows(
    seeds.map((seed, index) => makeProject({ position: keys[index], ...seed })),
    status,
  );
};

const listIds = (seeds: Seed[], status: ProjectStatus = 'ACTIVE') =>
  buildRows(seeds, status).map((row) => row.project.id);

describe('order within a group', () => {
  it('follows position rather than the order the rows arrived in', () => {
    expect(
      listIds([
        { id: 'c', position: 'a3' },
        { id: 'a', position: 'a1' },
        { id: 'b', position: 'a2' },
      ]),
    ).toEqual(['a', 'b', 'c']);
  });

  it('breaks a tie on id, so equal keys still order the same way twice', () => {
    expect(
      listIds([
        { id: 'b', position: 'a1' },
        { id: 'a', position: 'a1' },
      ]),
    ).toEqual(['a', 'b']);
  });

  it('renders a single project', () => {
    expect(listIds([{ id: 'only' }])).toEqual(['only']);
  });

  it('renders nothing when the section is empty', () => {
    expect(listIds([{ id: 'a', status: 'BACKLOG' }])).toEqual([]);
  });
});

describe('a corrupt tree still renders', () => {
  it('treats a parent that does not exist as a root', () => {
    expect(listIds([{ id: 'orphan', parent: 'missing' }])).toEqual(['orphan']);
    expect(buildRows([{ id: 'orphan', parent: 'missing' }])[0].depth).toBe(0);
  });

  it('treats a project that parents itself as a root', () => {
    expect(buildRows([{ id: 'loop', parent: 'loop' }])[0].depth).toBe(0);
  });
});

describe('hierarchy', () => {
  const tree: Seed[] = [
    { id: 'sport' },
    { id: 'workout', parent: 'sport' },
    { id: 'legs', parent: 'workout' },
  ];

  it('indents by ancestry length, with no cap', () => {
    expect(buildRows(tree).map((row) => row.depth)).toEqual([0, 1, 2]);
  });

  it('walks depth first', () => {
    expect(
      listIds([
        { id: 'a' },
        { id: 'a-child', parent: 'a' },
        { id: 'b' },
      ]),
    ).toEqual(['a', 'a-child', 'b']);
  });

  it('flags only the nodes that render children', () => {
    expect(buildRows(tree).map((row) => row.hasChildren)).toEqual([
      true,
      true,
      false,
    ]);
  });
});

describe('a category holds only its own projects', () => {
  const split: Seed[] = [
    { id: 'sport' },
    { id: 'workout', parent: 'sport' },
    { id: 'legs', parent: 'workout', status: 'BACKLOG' },
  ];

  it('never draws an ancestor from the other category', () => {
    expect(listIds(split, 'BACKLOG')).toEqual(['legs']);
  });

  it('renders a project whose parent is elsewhere at the top level', () => {
    expect(buildRows(split, 'BACKLOG').map((row) => row.depth)).toEqual([0]);
  });

  it('leaves the other category whole', () => {
    expect(listIds(split, 'ACTIVE')).toEqual(['sport', 'workout']);
  });

  it('omits a branch with nothing of this category in it', () => {
    expect(listIds([...split, { id: 'unrelated' }], 'BACKLOG')).not.toContain(
      'unrelated',
    );
  });

  it('gives no chevron to a parent whose children are all elsewhere', () => {
    expect(buildRows(split, 'ACTIVE').map((row) => row.hasChildren)).toEqual([
      true,
      false,
    ]);
  });
});

describe('colour', () => {
  it('uses its own colour when it has one', () => {
    expect(buildRows([{ id: 'sport', color: '#ff0000' }])[0].hexCode).toBe(
      '#ff0000',
    );
  });

  it('inherits from the nearest ancestor that has one', () => {
    const rows = buildRows([
      { id: 'sport', color: '#ff0000' },
      { id: 'workout', parent: 'sport' },
      { id: 'legs', parent: 'workout' },
    ]);

    expect(rows.map((row) => row.hexCode)).toEqual([
      '#ff0000',
      '#ff0000',
      '#ff0000',
    ]);
  });

  it('stops at the nearest one rather than the furthest', () => {
    const rows = buildRows([
      { id: 'sport', color: '#ff0000' },
      { id: 'workout', parent: 'sport', color: '#00ff00' },
      { id: 'legs', parent: 'workout' },
    ]);

    expect(rows.map((row) => row.hexCode)).toEqual([
      '#ff0000',
      '#00ff00',
      '#00ff00',
    ]);
  });

  it('marks a colour as its own only when the project carries one', () => {
    const rows = buildRows([
      { id: 'sport', color: '#ff0000' },
      { id: 'workout', parent: 'sport' },
      { id: 'legs', parent: 'workout', color: '#0000ff' },
      { id: 'errands' },
    ]);

    expect(rows.map((row) => row.ownsColor)).toEqual([
      true,
      false,
      true,
      false,
    ]);
  });

  it('leaves a project with no coloured ancestor blank', () => {
    const rows = buildRows([{ id: 'sport' }, { id: 'workout', parent: 'sport' }]);

    expect(rows.map((row) => row.hexCode)).toEqual([null, null]);
  });

  it('does not inherit from an ancestor in the other category', () => {
    const rows = buildRows(
      [
        { id: 'sport', color: '#ff0000' },
        { id: 'workout', parent: 'sport' },
        { id: 'legs', parent: 'workout', status: 'BACKLOG' },
      ],
      'BACKLOG',
    );

    expect(rows.map((row) => row.hexCode)).toEqual([null]);
  });
});

describe('collapsing', () => {
  const tree = [
    { id: 'sport' },
    { id: 'workout', parent: 'sport' },
    { id: 'legs', parent: 'workout' },
  ].map(makeProject);

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
