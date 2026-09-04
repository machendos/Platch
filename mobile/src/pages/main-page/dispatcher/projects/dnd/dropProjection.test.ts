import { describe, expect, it } from 'vitest';
import type { ProjectionRow } from './dropProjection';
import { resolveDrop } from './dropProjection';

const INDENT = 16;

const rows: ProjectionRow[] = [
  { id: 'sport', depth: 0 },
  { id: 'workout', depth: 1 },
  { id: 'legs', depth: 2 },
  { id: 'errands', depth: 0 },
];

const resolveDropAt = (
  gapIndex: number,
  offsetX = 0,
  extra: { startDepth?: number; previousDepth?: number } = {},
) =>
  resolveDrop({
    rows,
    gapIndex,
    offsetX,
    indentStep: INDENT,
    startDepth: extra.startDepth ?? 0,
    previousDepth: extra.previousDepth,
  });

describe('depth is bounded by its neighbours', () => {
  it('cannot go deeper than one level under the row above', () => {
    expect(resolveDropAt(3, INDENT * 9).depth).toBe(3);
  });

  it('cannot go shallower than the row below', () => {
    expect(resolveDropAt(1, -INDENT * 9).depth).toBe(1);
  });

  it('is a root at the very top of the list', () => {
    expect(resolveDropAt(0, INDENT * 9).depth).toBe(0);
  });

  it('follows the pointer between those bounds', () => {
    expect(resolveDropAt(3, 0).depth).toBe(0 + 0);
    expect(resolveDropAt(3, INDENT).depth).toBe(1);
    expect(resolveDropAt(3, INDENT * 2).depth).toBe(2);
  });

  it('measures the offset from the depth the drag started at', () => {
    expect(resolveDropAt(3, 0, { startDepth: 2 }).depth).toBe(2);
    expect(resolveDropAt(3, -INDENT, { startDepth: 2 }).depth).toBe(1);
  });
});

describe('hysteresis', () => {
  it('holds its depth while the pointer sits near a boundary', () => {
    expect(resolveDropAt(3, INDENT * 0.6, { previousDepth: 0 }).depth).toBe(0);
  });

  it('gives way once the pointer travels past the dead band', () => {
    expect(resolveDropAt(3, INDENT * 0.9, { previousDepth: 0 }).depth).toBe(1);
  });

  it('is symmetric coming back the other way', () => {
    expect(resolveDropAt(3, INDENT * 0.45, { previousDepth: 1 }).depth).toBe(1);
    expect(resolveDropAt(3, INDENT * 0.1, { previousDepth: 1 }).depth).toBe(0);
  });

  it('rounds plainly on the first frame, with nothing to hold on to', () => {
    expect(resolveDropAt(3, INDENT * 0.6).depth).toBe(1);
  });
});

describe('parent and predecessor', () => {
  it('has neither at the top of the list', () => {
    expect(resolveDropAt(0)).toMatchObject({
      parentProjectId: null,
      prevSiblingId: null,
    });
  });

  it('reports the row it lands in front of', () => {
    expect(resolveDropAt(0).nextSiblingId).toBe('sport');
    expect(resolveDropAt(1, INDENT).nextSiblingId).toBe('workout');
    expect(resolveDropAt(2, INDENT * 2).nextSiblingId).toBe('legs');
  });

  it('has none when the row below closes the group instead', () => {
    expect(resolveDropAt(3, INDENT).nextSiblingId).toBe(null);
    expect(resolveDropAt(4, 0).nextSiblingId).toBe(null);
  });

  it('takes the row above as parent when nesting under it', () => {
    expect(resolveDropAt(1, INDENT)).toMatchObject({
      depth: 1,
      parentProjectId: 'sport',
      prevSiblingId: null,
    });
  });

  it('follows a sibling at the same depth', () => {
    expect(resolveDropAt(3, INDENT)).toMatchObject({
      depth: 1,
      parentProjectId: 'sport',
      prevSiblingId: 'workout',
    });
  });

  it('skips over deeper rows to find the sibling', () => {
    expect(resolveDropAt(3, INDENT).prevSiblingId).toBe('workout');
  });

  it('stops at the parent rather than looking past it', () => {
    expect(resolveDropAt(3, INDENT * 2)).toMatchObject({
      depth: 2,
      parentProjectId: 'workout',
      prevSiblingId: 'legs',
    });
  });

  it('finds no predecessor when it would be the first child', () => {
    expect(resolveDropAt(2, INDENT * 2)).toMatchObject({
      depth: 2,
      parentProjectId: 'workout',
      prevSiblingId: null,
    });
  });

  it('lands at the root after the last root project', () => {
    expect(resolveDropAt(4, 0)).toMatchObject({
      depth: 0,
      parentProjectId: null,
      prevSiblingId: 'errands',
    });
  });
});

describe('an empty list', () => {
  it('projects a lone root', () => {
    expect(
      resolveDrop({
        rows: [],
        gapIndex: 0,
        offsetX: INDENT * 5,
        indentStep: INDENT,
        startDepth: 0,
      }),
    ).toEqual({
      depth: 0,
      parentProjectId: null,
      prevSiblingId: null,
      nextSiblingId: null,
    });
  });
});
