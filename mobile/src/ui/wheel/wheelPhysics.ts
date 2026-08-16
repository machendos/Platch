export type PointerSample = {
  time: number;
  y: number;
};

const SAMPLE_WINDOW_MS = 80;

// Only the tail of the gesture decides the throw. Averaging the whole drag
// makes a long slow drag ending in a flick read as slow, which is the opposite
// of what the hand just did.
export const velocityFrom = (
  samples: PointerSample[],
  now: number,
  window = SAMPLE_WINDOW_MS,
): number => {
  const recent = samples.filter((sample) => now - sample.time <= window);
  if (recent.length < 2) return 0;

  const first = recent[0];
  const last = recent[recent.length - 1];
  const elapsed = last.time - first.time;

  return elapsed <= 0 ? 0 : (last.y - first.y) / elapsed;
};

export const maxOffset = (count: number, itemHeight: number) =>
  Math.max(count - 1, 0) * itemHeight;

export const clampOffset = (
  offset: number,
  count: number,
  itemHeight: number,
) => Math.min(Math.max(offset, 0), maxOffset(count, itemHeight));

// Past the end the wheel keeps following the finger, but gives less ground the
// further it is pulled — the pull approaches `limit` and never passes it. Same
// shape a scrollable page uses at its edges: the resistance is what says "this
// is the end" without the wheel simply refusing to move.
export const rubberBand = (overshoot: number, limit: number): number => {
  const pulled = Math.abs(overshoot);
  return Math.sign(overshoot) * (1 - 1 / (pulled / limit + 1)) * limit;
};

export const withRubberBand = (
  offset: number,
  count: number,
  itemHeight: number,
  limit: number,
): number => {
  const end = maxOffset(count, itemHeight);

  if (offset < 0) return rubberBand(offset, limit);
  if (offset > end) return end + rubberBand(offset - end, limit);

  return offset;
};

export const isBeyondEnds = (
  offset: number,
  count: number,
  itemHeight: number,
) => offset < 0 || offset > maxOffset(count, itemHeight);

export const indexAt = (
  offset: number,
  itemHeight: number,
  count: number,
): number =>
  Math.min(
    Math.max(Math.round(offset / itemHeight), 0),
    Math.max(count - 1, 0),
  );

export const detentOffset = (
  offset: number,
  itemHeight: number,
  count: number,
) => indexAt(offset, itemHeight, count) * itemHeight;

// Velocity decays as v(t) = v0 * rate^t, so the coast integrates to
// -v0 / ln(rate). Projecting it in closed form means one tween rather than a
// per-frame simulation, and the resting place is known before it starts.
export const flingDistance = (velocity: number, decelerationRate: number) =>
  -velocity / Math.log(decelerationRate);

// Time for that decay to fall to `restVelocity`. This is the part a plain
// distance/speed estimate gets wrong: it grows with the *logarithm* of the
// throw, so a hard flick genuinely coasts longer instead of being cut off at a
// fixed ceiling and stopping dead.
export const flingDuration = (
  velocity: number,
  feel: {
    decelerationRate: number;
    restVelocity: number;
    minSettleMs: number;
    maxFlingMs: number;
  },
): number => {
  const speed = Math.abs(velocity);
  if (speed <= feel.restVelocity) return feel.minSettleMs;

  const seconds =
    Math.log(feel.restVelocity / speed) / Math.log(feel.decelerationRate);

  return Math.min(Math.max(seconds, feel.minSettleMs), feel.maxFlingMs);
};

export const flingTarget = (
  offset: number,
  velocity: number,
  count: number,
  itemHeight: number,
  feel: { decelerationRate: number; minFlingVelocity: number },
): number => {
  const thrown =
    Math.abs(velocity) < feel.minFlingVelocity
      ? offset
      : offset + flingDistance(velocity, feel.decelerationRate);

  return clampOffset(
    detentOffset(clampOffset(thrown, count, itemHeight), itemHeight, count),
    count,
    itemHeight,
  );
};

// The same decay, normalised to reach exactly 1 at `duration`. Using the real
// curve rather than a cubic is what produces the long slow crawl into the
// resting row — a cubic has spent its speed well before the end and then stops.
export const decayProgress = (
  elapsed: number,
  duration: number,
  decelerationRate: number,
): number => {
  const spent = 1 - decelerationRate ** duration;
  if (spent <= 0) return 1;

  return (1 - decelerationRate ** elapsed) / spent;
};

export const easeOut = (progress: number) => 1 - (1 - progress) ** 3;
