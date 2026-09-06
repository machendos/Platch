import { describe, expect, it } from 'vitest';
import type { ProjectWithTimeSlots } from '../../../../api/structures/ProjectWithTimeSlots';
import type { ProjectStatus } from './projectTree';
import { otherCategory, resolveCategoryMove } from './categoryMove';

type Seed = {
  id: string;
  name?: string | null;
  parent?: string | null;
  position?: string;
  status?: ProjectStatus;
};

const makeProject = ({
  id,
  name,
  parent = null,
  position = 'a0',
  status = 'BACKLOG',
}: Seed): ProjectWithTimeSlots =>
  ({
    id,
    name: name === undefined ? id : name,
    parentProjectId: parent,
    position,
    projectStatus: status,
    color: null,
    timeComponents: [],
    userId: 'user',
  }) as unknown as ProjectWithTimeSlots;

const plan = (seeds: Seed[], id: string, target: ProjectStatus = 'ACTIVE') => {
  const projects = seeds.map(makeProject);
  const moved = projects.find((project) => project.id === id) as ProjectWithTimeSlots;

  return resolveCategoryMove(projects, moved, target);
};

describe('resolveCategoryMove', () => {
  const source: Seed[] = [
    { id: 'sport' },
    { id: 'workout', parent: 'sport' },
    { id: 'legs', parent: 'workout' },
  ];

  it('lands at the root when the destination has nothing to match', () => {
    expect(plan(source, 'legs')).toMatchObject({
      id: 'legs',
      parentProjectId: null,
      projectStatus: 'ACTIVE',
    });
  });

  it('lands under the deepest name that matches the whole path', () => {
    const plan_ = plan(
      [
        ...source,
        { id: 'a-sport', name: 'sport', status: 'ACTIVE' },
        { id: 'a-workout', name: 'workout', parent: 'a-sport', status: 'ACTIVE' },
      ],
      'legs',
    );

    expect(plan_.parentProjectId).toBe('a-workout');
  });

  it('stops at the deepest prefix that matches', () => {
    const plan_ = plan(
      [...source, { id: 'a-sport', name: 'sport', status: 'ACTIVE' }],
      'legs',
    );

    expect(plan_.parentProjectId).toBe('a-sport');
  });

  it('ignores case and surrounding space', () => {
    const plan_ = plan(
      [...source, { id: 'a-sport', name: '  SPORT ', status: 'ACTIVE' }],
      'legs',
    );

    expect(plan_.parentProjectId).toBe('a-sport');
  });

  it('never matches an unnamed project', () => {
    const plan_ = plan(
      [
        { id: 'sport', name: null },
        { id: 'legs', parent: 'sport' },
        { id: 'a-sport', name: null, status: 'ACTIVE' },
      ],
      'legs',
    );

    expect(plan_.parentProjectId).toBeNull();
  });

  it('never matches a blank name either', () => {
    const plan_ = plan(
      [
        { id: 'sport', name: '   ' },
        { id: 'legs', parent: 'sport' },
        { id: 'a-sport', name: '', status: 'ACTIVE' },
      ],
      'legs',
    );

    expect(plan_.parentProjectId).toBeNull();
  });

  it('takes the first of two same-named candidates and stops there', () => {
    const plan_ = plan(
      [
        ...source,
        { id: 'first', name: 'sport', position: 'a1', status: 'ACTIVE' },
        { id: 'second', name: 'sport', position: 'a2', status: 'ACTIVE' },
        {
          id: 'deeper',
          name: 'workout',
          parent: 'second',
          status: 'ACTIVE',
        },
      ],
      'legs',
    );

    /* `second` would have matched one level deeper, but the descent commits to
       the first candidate — which is the one the user can see is first. */
    expect(plan_.parentProjectId).toBe('first');
  });

  it('ignores ancestry the project does not show in the category it leaves', () => {
    /* `legs` has a parent, but that parent is already in the destination, so
       `legs` renders at the top level where it is — and matches as one. */
    const plan_ = plan(
      [
        { id: 'workout', status: 'ACTIVE' },
        { id: 'legs', parent: 'workout' },
        { id: 'a-workout', name: 'workout', status: 'ACTIVE' },
      ],
      'legs',
    );

    expect(plan_.parentProjectId).toBeNull();
  });

  it('lands at the top of the destination group', () => {
    const plan_ = plan(
      [
        ...source,
        { id: 'a-sport', name: 'sport', status: 'ACTIVE' },
        { id: 'eldest', parent: 'a-sport', position: 'a1', status: 'ACTIVE' },
      ],
      'legs',
    );

    expect(plan_.nextSiblingId).toBe('eldest');
    expect(plan_.prevSiblingId).toBeNull();
    expect(plan_.position < 'a1').toBe(true);
  });
});

describe('otherCategory', () => {
  it('swaps the two', () => {
    expect(otherCategory('ACTIVE')).toBe('BACKLOG');
    expect(otherCategory('BACKLOG')).toBe('ACTIVE');
  });
});
