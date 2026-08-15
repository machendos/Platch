export type BreadcrumbSlot =
  | { kind: 'item'; index: number; maxWidth: number | null }
  | { kind: 'collapsed'; indices: number[] };

type PlanInput = {
  count: number;
  currentIndex: number;
  /** Natural rendered width of every label, index-aligned with the path. */
  naturalWidths: number[];
  separatorWidth: number;
  ellipsisWidth: number;
  available: number;
};

/**
 * Width of a layout holding exactly `admitted`, with every run of omitted
 * nodes standing as one `…`. `widthOf` is a function so the same arithmetic
 * can price a row of whole labels and a row of shortened ones.
 */
const layoutWidth = (
  admitted: number[],
  count: number,
  widthOf: (index: number) => number,
  separatorWidth: number,
  ellipsisWidth: number,
): number => {
  let total = 0;
  let slots = 0;
  let previous = -1;

  for (const index of admitted) {
    if (index > previous + 1) {
      total += ellipsisWidth;
      slots += 1;
    }
    total += widthOf(index);
    slots += 1;
    previous = index;
  }

  if (previous < count - 1) {
    total += ellipsisWidth;
    slots += 1;
  }

  return total + Math.max(slots - 1, 0) * separatorWidth;
};

const collapse = (
  admitted: number[],
  count: number,
  maxWidthOf: (index: number) => number | null,
): BreadcrumbSlot[] => {
  const slots: BreadcrumbSlot[] = [];
  let previous = -1;

  const gap = (from: number, to: number) => {
    const indices = [];
    for (let index = from; index <= to; index++) indices.push(index);
    if (indices.length > 0) slots.push({ kind: 'collapsed', indices });
  };

  for (const index of admitted) {
    gap(previous + 1, index - 1);
    slots.push({ kind: 'item', index, maxWidth: maxWidthOf(index) });
    previous = index;
  }

  gap(previous + 1, count - 1);
  return slots;
};

/**
 * Equal shares of `budget`, except that a label needing less than its share
 * takes only what it needs and the remainder is redistributed to the rest.
 * Splitting strictly down the middle would clip a short label to make room for
 * space a long one cannot use.
 */
const shareEqually = (
  indices: number[],
  budget: number,
  naturalWidths: number[],
): Map<number, number> => {
  const granted = new Map<number, number>();
  let remaining = budget;
  let pending = [...indices];

  while (pending.length > 0) {
    const share = remaining / pending.length;
    const satisfied = pending.filter(
      (index) => (naturalWidths[index] ?? 0) <= share,
    );

    if (satisfied.length === 0) {
      for (const index of pending) granted.set(index, share);
      break;
    }

    for (const index of satisfied) {
      const natural = naturalWidths[index] ?? 0;
      granted.set(index, natural);
      remaining -= natural;
    }

    pending = pending.filter((index) => !satisfied.includes(index));
  }

  return granted;
};

/**
 * Nodes are admitted one at a time, each at its natural width, and the first
 * one that does not fit whole is shown clipped to whatever room is left — after
 * which nothing further is added.
 *
 * **A clipped label carries no `…`.** That is what keeps `…` meaning one thing
 * and one thing only: *nodes are hidden here, open me*. An earlier version
 * clipped with an ellipsis and produced rows like
 * `Pare… / Pare… / Pare… / This pr…`, where the same character meant "more
 * text" in one place and "more nodes" in another and the row communicated
 * nothing.
 *
 * The order is:
 *
 *   1. the current node and the leaf, always
 *   2. the root
 *   3. the leaf's parent, then its parent, then its parent …
 *
 * **The walk climbs from the leaf, not from the current node.** The path from
 * the root to the leaf is the thing being described; the current node is only a
 * cursor marking where the reader is inside it. Climbing from the leaf means
 * one pass covers everything, and the nodes between the cursor and the leaf
 * need no rule of their own — they are simply the first ones the walk reaches.
 *
 * The walk terminates at index 1, so the second node from the top is always
 * the last one considered — that rule needs no special case either.
 */
export const planBreadcrumbs = ({
  count,
  currentIndex,
  naturalWidths,
  separatorWidth,
  ellipsisWidth,
  available,
}: PlanInput): BreadcrumbSlot[] => {
  if (count === 0) return [];

  const leafIndex = count - 1;
  const natural = (index: number) => naturalWidths[index] ?? 0;
  const admitted = [...new Set([currentIndex, leafIndex])].sort(
    (a, b) => a - b,
  );
  const clipped = new Map<number, number>();

  // `except` is priced at zero, which turns the same arithmetic into "how much
  // room would be left for this node".
  const widthOf = (candidate: number[], except?: number) =>
    layoutWidth(
      candidate,
      count,
      (index) => (index === except ? 0 : natural(index)),
      separatorWidth,
      ellipsisWidth,
    );

  // The mandatory pair cannot be dropped, so when they will not both fit they
  // split what is left after the separators and `…` groups have taken theirs,
  // and nothing else is shown at all.
  if (widthOf(admitted) > available) {
    const chrome = layoutWidth(
      admitted,
      count,
      () => 0,
      separatorWidth,
      ellipsisWidth,
    );
    const granted = shareEqually(
      admitted,
      Math.max(available - chrome, 0),
      naturalWidths,
    );

    return collapse(admitted, count, (index) => {
      const allowed = granted.get(index) ?? 0;
      return allowed >= natural(index) ? null : allowed;
    });
  }

  let stopped = false;

  const consider = (index: number) => {
    if (stopped || admitted.includes(index)) return;

    const candidate = [...admitted, index].sort((a, b) => a - b);

    if (widthOf(candidate) <= available) {
      admitted.splice(0, admitted.length, ...candidate);
      return;
    }

    // It does not fit whole, so it takes what is left and the row ends here.
    // Admitting it clipped rather than skipping on to a narrower node further
    // away is also what holds the promise of at most two `…` groups: the nodes
    // shown stay one unbroken run through the current node, so the only gaps
    // possible are before it and after it.
    stopped = true;

    const remainder = available - widthOf(candidate, index);
    if (remainder <= 0) return;

    admitted.splice(0, admitted.length, ...candidate);
    clipped.set(index, remainder);
  };

  consider(0);

  // Climbing from the leaf, not from the current node. Reaching the cursor on
  // the way is a no-op — it is already in — so a single pass fills the row
  // whether the cursor sits at the leaf, half way up, or on the root itself.
  for (let index = leafIndex - 1; index >= 1; index--) consider(index);

  return collapse(admitted, count, (index) => clipped.get(index) ?? null);
};
