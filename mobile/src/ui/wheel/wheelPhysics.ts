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

// The row a move travelling `towards` has actually *reached*, as opposed to the
// one it is merely nearest. `indexAt` rounds, so it changes halfway between two
// rows — fine while a finger is on the wheel, wrong for a move the wheel is
// making on its own, where it flips the selection and sounds the tick while the
// row is still visibly travelling toward the centre.
export const rowReached = (
  offset: number,
  itemHeight: number,
  count: number,
  towards: number,
): number => {
  const rows = offset / itemHeight;
  const reached =
    towards > 0 ? Math.floor(rows + 0.001) : Math.ceil(rows - 0.001);

  return Math.min(Math.max(reached, 0), Math.max(count - 1, 0));
};

// How much further than its face value a scroll event should carry, from how
// fast the scrolling is going. A slow, deliberate notch keeps its exact
// one-row meaning; a flick multiplies, which is what gives scrolling something
// like the reach a throw has.
export const wheelGain = (
  delta: number,
  elapsed: number,
  feel: { wheelGainFrom: number; wheelGainMax: number },
): number => {
  const speed = Math.abs(delta) / Math.max(elapsed, 1);

  return Math.min(Math.max(speed / feel.wheelGainFrom, 1), feel.wheelGainMax);
};

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

// How long the decay takes to cover `distance`, and how much speed is left on
// arrival. Both fall out of v(t) = v0 * rate^t, and together they are what lets
// a throw run at its own pace all the way to the end instead of being stretched
// thin over a distance it was never going to need.
export const timeToTravel = (
  distance: number,
  velocity: number,
  decelerationRate: number,
): number => {
  const decay = Math.log(decelerationRate);
  const remaining = 1 + (distance * decay) / velocity;

  return remaining <= 0 ? Infinity : Math.log(remaining) / decay;
};

export const velocityAfter = (
  distance: number,
  velocity: number,
  decelerationRate: number,
) => velocity + distance * Math.log(decelerationRate);

export type FlingPlan = {
  to: number;
  duration: number;
  /** Set only when the throw runs out of wheel and has to spring back. */
  bounce: { to: number; duration: number } | null;
};

type FlingFeel = {
  decelerationRate: number;
  restVelocity: number;
  minFlingVelocity: number;
  minSettleMs: number;
  maxFlingMs: number;
  overscroll: number;
  bounceMs: number;
  impactGive: number;
};

export const planFling = (
  offset: number,
  velocity: number,
  count: number,
  itemHeight: number,
  feel: FlingFeel,
): FlingPlan => {
  const settle = (to: number) => ({
    to: detentOffset(clampOffset(to, count, itemHeight), itemHeight, count),
    duration: feel.minSettleMs,
    bounce: null,
  });

  if (Math.abs(velocity) < feel.minFlingVelocity) return settle(offset);

  const natural = flingDistance(velocity, feel.decelerationRate);
  const end = velocity > 0 ? maxOffset(count, itemHeight) : 0;
  const room = end - offset;

  // Comes to rest before running out of wheel: an ordinary throw.
  if (Math.abs(natural) <= Math.abs(room)) {
    return {
      to: detentOffset(
        clampOffset(offset + natural, count, itemHeight),
        itemHeight,
        count,
      ),
      duration: flingDuration(velocity, feel),
      bounce: null,
    };
  }

  // Reaches the end with speed to spare. It keeps its own pace to get there
  // rather than being slowed to land exactly on the last row, and what is left
  // over is spent against the rubber band — so a harder throw hits it harder.
  //
  // The depth comes from the speed on arrival, not from the distance the throw
  // still had in it: that distance is large even for a soft throw, so using it
  // sank a gentle arrival almost as deep as a violent one.
  const left = velocityAfter(room, velocity, feel.decelerationRate);
  const peak = rubberBand(left * feel.impactGive, feel.overscroll);
  const reach = timeToTravel(room, velocity, feel.decelerationRate);
  const compress = Math.min(
    Math.max(Math.abs(peak) / Math.max(Math.abs(left), 0.05), 60),
    260,
  );

  // A shallow dent springs back sooner than a deep one, so a light touch on the
  // end is over quickly instead of dwelling for the full bounce.
  const spring = Math.min(
    Math.max(
      (feel.bounceMs * Math.abs(peak)) / feel.overscroll,
      feel.minSettleMs,
    ),
    feel.bounceMs,
  );

  return {
    to: end + peak,
    duration: Math.min(
      Math.max(reach + compress, feel.minSettleMs),
      feel.maxFlingMs,
    ),
    bounce: { to: end, duration: spring },
  };
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
