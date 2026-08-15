import { describe, expect, it } from 'vitest';
import { planBreadcrumbs } from './breadcrumbLayout';

const SEPARATOR = 10;
const ELLIPSIS = 20;

// Every label the same width unless a test says otherwise, so expectations are
// about the algorithm rather than arithmetic on seven different numbers.
const plan = (
  count: number,
  currentIndex: number,
  available: number,
  naturalWidths: number[] = Array.from({ length: count }, () => 100),
) =>
  planBreadcrumbs({
    count,
    currentIndex,
    naturalWidths,
    separatorWidth: SEPARATOR,
    ellipsisWidth: ELLIPSIS,
    available,
  });

const shown = (slots: ReturnType<typeof plan>) =>
  slots.map((slot) =>
    slot.kind === 'item' ? slot.index : `…${slot.indices.join(',')}`,
  );

const rowWidth = (
  slots: ReturnType<typeof plan>,
  naturalWidths: number[] = [],
) =>
  slots.reduce(
    (total, slot) =>
      total +
      (slot.kind === 'collapsed'
        ? ELLIPSIS
        : (slot.maxWidth ?? naturalWidths[slot.index] ?? 100)),
    Math.max(slots.length - 1, 0) * SEPARATOR,
  );

describe('planBreadcrumbs', () => {
  it('shows the whole path when it fits', () => {
    expect(shown(plan(3, 2, 1000))).toEqual([0, 1, 2]);
  });

  it('always shows the current node and the leaf', () => {
    for (const available of [0, 40, 120, 300, 900]) {
      const visible = shown(plan(7, 2, available));
      expect(visible).toContain(2);
      expect(visible).toContain(6);
    }
  });

  // The mandatory pair needs 240 and the row is 250, so the root has nothing
  // left to be clipped into. A sliver is worse than an honest `…`.
  it('drops a node with no room left rather than showing a sliver', () => {
    expect(shown(plan(7, 5, 250))).toEqual(['…0,1,2,3,4', 5, 6]);
  });

  it('takes the root before any ancestor of the current node', () => {
    expect(shown(plan(7, 5, 350))).toEqual([0, '…1,2,3,4', 5, 6]);
  });

  it('walks up from the direct parent once the root is in', () => {
    expect(shown(plan(7, 5, 460))).toEqual([0, '…1,2,3', 4, 5, 6]);
  });

  // 650 would hold the whole path, so at 600 exactly one node has to give up
  // width — and it is the second from the root.
  it('leaves the second node from the root until last', () => {
    const slots = plan(6, 5, 600);
    expect(shown(slots)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(
      slots.filter((slot) => slot.kind === 'item' && slot.maxWidth !== null),
    ).toMatchObject([{ index: 1 }]);
  });

  // Stepping up to an ancestor leaves the way back down inside the trailing
  // `…`. Filling the row with it is the whole reason descendants are ranked at
  // all: without this the current node sat at the root beside one `…` and left
  // more than half the row empty.
  // Without this the row was `0 / … / 6` at any width: the current node sat at
  // the root, there were no ancestors to walk, and more than half the row went
  // unused while five nodes stayed hidden.
  // The cursor sitting on the root leaves no ancestors of its own to walk, and
  // the row still fills — because the walk climbs from the leaf regardless.
  it('fills the row from the leaf upwards when the cursor is at the root', () => {
    const slots = plan(7, 0, 600);
    expect(shown(slots)).toEqual([0, '…1', 2, 3, 4, 5, 6]);
    expect(
      slots.filter((slot) => slot.kind === 'item' && slot.maxWidth !== null),
    ).toMatchObject([{ index: 2 }]);
  });

  // The leaf's parents come in before the cursor's. The path being described
  // runs root → leaf; the cursor only marks a position inside it.
  it('climbs from the leaf, not from the current node', () => {
    const slots = plan(7, 3, 500);
    expect(shown(slots)).toEqual([0, '…1,2', 3, 4, 5, 6]);
    expect(
      slots.filter((slot) => slot.kind === 'item' && slot.maxWidth !== null),
    ).toMatchObject([{ index: 4 }]);
  });

  it('clips the first node that will not fit whole', () => {
    // The root wants 350 of the 320 on offer, so it takes what is left.
    const slots = plan(7, 5, 320);
    expect(shown(slots)).toEqual([0, '…1,2,3,4', 5, 6]);
    const root = slots.find((slot) => slot.kind === 'item' && slot.index === 0);
    expect(root).toMatchObject({ maxWidth: 70 });
  });

  it('shows nothing after a clipped node', () => {
    // Index 4 is too wide to join whole; 3, 2 and 1 are never considered.
    const widths = [50, 50, 50, 50, 400, 50, 50];
    const slots = plan(7, 5, 300, widths);
    expect(shown(slots)).toEqual([0, '…1,2,3', 4, 5, 6]);
  });

  it('clips at most one node once the mandatory pair fits', () => {
    const widths = [100, 260, 100, 260, 100, 260, 100, 260, 100];
    for (let count = 2; count <= 9; count++) {
      for (let current = 0; current < count; current++) {
        for (const available of [200, 340, 500, 780, 1200]) {
          const slots = plan(count, current, available, widths.slice(0, count));
          const clipped = slots.filter(
            (slot) => slot.kind === 'item' && slot.maxWidth !== null,
          );

          // A clipped mandatory node means the pair did not fit, which is the
          // other branch — it is allowed to clip both.
          const mandatoryClipped = clipped.some(
            (slot) =>
              slot.kind === 'item' &&
              (slot.index === current || slot.index === count - 1),
          );
          if (mandatoryClipped) continue;

          expect(clipped.length).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('never produces more than two collapsed groups', () => {
    const widths = [100, 400, 100, 400, 100, 400, 100, 400, 100];
    for (let current = 0; current < 9; current++) {
      for (const available of [120, 260, 400, 640, 900]) {
        const groups = plan(9, current, available, widths).filter(
          (slot) => slot.kind === 'collapsed',
        );
        expect(groups.length).toBeLessThanOrEqual(2);
      }
    }
  });

  it('shows a node whole when it fits to the pixel', () => {
    const slots = plan(7, 5, 350);
    expect(shown(slots)).toEqual([0, '…1,2,3,4', 5, 6]);
    expect(
      slots.every((slot) => slot.kind !== 'item' || slot.maxWidth === null),
    ).toBe(true);
  });

  describe('when the current node and the leaf cannot both be shown whole', () => {
    it('shortens them rather than dropping either', () => {
      const slots = plan(5, 0, 150);
      expect(shown(slots)).toEqual([0, '…1,2,3', 4]);
      expect(
        slots.every((slot) => slot.kind !== 'item' || slot.maxWidth !== null),
      ).toBe(true);
    });

    it('gives them equal shares when both are too wide', () => {
      const slots = plan(5, 0, 150, [300, 50, 50, 50, 300]);
      const caps = slots.flatMap((slot) =>
        slot.kind === 'item' ? [slot.maxWidth] : [],
      );
      expect(caps[0]).toBe(caps[1]);
    });

    // Splitting strictly down the middle would clip a short label to reserve
    // room the long one cannot use.
    it('lets a short label keep its width and gives the rest away', () => {
      const slots = plan(5, 0, 150, [40, 50, 50, 50, 300]);
      const caps = slots.flatMap((slot) =>
        slot.kind === 'item' ? [slot.maxWidth] : [],
      );
      expect(caps[0]).toBeNull();
      expect(caps[1]).toBeGreaterThan(40);
    });
  });

  // The separators and `…` groups are not compressible, so below the width
  // they alone need there is nothing left to give up — every label goes to
  // zero and the container clips. Above it, the row always fits.
  it('never plans a row wider than the space it was given', () => {
    const widths = [100, 260, 100, 260, 100, 260, 100, 260, 100];

    for (let count = 1; count <= 9; count++) {
      for (let current = 0; current < count; current++) {
        for (const available of [60, 120, 240, 480, 960]) {
          const slots = plan(count, current, available, widths.slice(0, count));
          const chrome = rowWidth(
            slots.map((slot) =>
              slot.kind === 'item' ? { ...slot, maxWidth: 0 } : slot,
            ),
          );

          if (chrome > available) {
            expect(
              slots.every(
                (slot) => slot.kind !== 'item' || slot.maxWidth === 0,
              ),
            ).toBe(true);
            continue;
          }

          expect(rowWidth(slots, widths)).toBeLessThanOrEqual(available);
        }
      }
    }
  });

  it('handles an empty path', () => {
    expect(plan(0, 0, 500)).toEqual([]);
  });

  it('handles a single node that is also the current one and the leaf', () => {
    expect(shown(plan(1, 0, 500))).toEqual([0]);
  });
});
