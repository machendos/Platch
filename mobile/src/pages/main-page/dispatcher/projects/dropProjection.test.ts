import { describe, expect, it } from 'vitest';
import type { ProjectionRow } from './dropProjection';
import { projectDrop } from './dropProjection';

const INDENT = 16;

/* sport
     workout
       legs
   errands  */
const rows: ProjectionRow[] = [
  { id: 'sport', depth: 0 },
  { id: 'workout', depth: 1 },
  { id: 'legs', depth: 2 },
  { id: 'errands', depth: 0 },
];

const drop = (
  gapIndex: number,
  offsetX = 0,
  extra: { startDepth?: number; previousDepth?: number } = {},
) =>
  projectDrop({
    rows,
    gapIndex,
    offsetX,
    indentStep: INDENT,
    startDepth: extra.startDepth ?? 0,
    previousDepth: extra.previousDepth,
  });

describe('depth is bounded by its neighbours', () => {
  it('cannot go deeper than one level under the row above', () => {
    // Above is `legs` at depth 2, so 3 is the deepest legal landing.
    expect(drop(3, INDENT * 9).depth).toBe(3);
  });

  it('cannot go shallower than the row below', () => {
    // Below is `workout` at depth 1, so leaving it parentless is not offered.
    expect(drop(1, -INDENT * 9).depth).toBe(1);
  });

  it('is a root at the very top of the list', () => {
    expect(drop(0, INDENT * 9).depth).toBe(0);
  });

  it('follows the pointer between those bounds', () => {
    expect(drop(3, 0).depth).toBe(0 + 0);
    expect(drop(3, INDENT).depth).toBe(1);
    expect(drop(3, INDENT * 2).depth).toBe(2);
  });

  it('measures the offset from the depth the drag started at', () => {
    expect(drop(3, 0, { startDepth: 2 }).depth).toBe(2);
    expect(drop(3, -INDENT, { startDepth: 2 }).depth).toBe(1);
  });
});

describe('hysteresis', () => {
  it('holds its depth while the pointer sits near a boundary', () => {
    // Half a step past 0 would round to 1 without a dead band.
    expect(drop(3, INDENT * 0.6, { previousDepth: 0 }).depth).toBe(0);
  });

  it('gives way once the pointer travels past the dead band', () => {
    expect(drop(3, INDENT * 0.9, { previousDepth: 0 }).depth).toBe(1);
  });

  it('is symmetric coming back the other way', () => {
    expect(drop(3, INDENT * 0.45, { previousDepth: 1 }).depth).toBe(1);
    expect(drop(3, INDENT * 0.1, { previousDepth: 1 }).depth).toBe(0);
  });

  it('rounds plainly on the first frame, with nothing to hold on to', () => {
    expect(drop(3, INDENT * 0.6).depth).toBe(1);
  });
});

describe('parent and predecessor', () => {
  it('has neither at the top of the list', () => {
    expect(drop(0)).toMatchObject({
      parentProjectId: null,
      prevProjectIdInHierarchy: null,
    });
  });

  it('takes the row above as parent when nesting under it', () => {
    expect(drop(1, INDENT)).toMatchObject({
      depth: 1,
      parentProjectId: 'sport',
      prevProjectIdInHierarchy: null,
    });
  });

  it('follows a sibling at the same depth', () => {
    // Landing at depth 1 below `legs`: workout is the sibling to follow.
    expect(drop(3, INDENT)).toMatchObject({
      depth: 1,
      parentProjectId: 'sport',
      prevProjectIdInHierarchy: 'workout',
    });
  });

  it('skips over deeper rows to find the sibling', () => {
    // `legs` sits between, but it is a descendant, not a candidate.
    expect(drop(3, INDENT).prevProjectIdInHierarchy).toBe('workout');
  });

  it('stops at the parent rather than looking past it', () => {
    // At depth 2 after `legs` there is no earlier sibling under `workout`.
    expect(drop(3, INDENT * 2)).toMatchObject({
      depth: 2,
      parentProjectId: 'workout',
      prevProjectIdInHierarchy: 'legs',
    });
  });

  it('finds no predecessor when it would be the first child', () => {
    expect(drop(2, INDENT * 2)).toMatchObject({
      depth: 2,
      parentProjectId: 'workout',
      prevProjectIdInHierarchy: null,
    });
  });

  it('lands at the root after the last root project', () => {
    expect(drop(4, 0)).toMatchObject({
      depth: 0,
      parentProjectId: null,
      prevProjectIdInHierarchy: 'errands',
    });
  });
});

describe('an empty list', () => {
  it('projects a lone root', () => {
    expect(
      projectDrop({
        rows: [],
        gapIndex: 0,
        offsetX: INDENT * 5,
        indentStep: INDENT,
        startDepth: 0,
      }),
    ).toEqual({
      depth: 0,
      parentProjectId: null,
      prevProjectIdInHierarchy: null,
    });
  });
});
