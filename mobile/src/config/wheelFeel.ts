// Every knob that decides how a wheel feels. Tune here, not in the component.
export const WHEEL_FEEL = {
  itemHeight: 34,
  visibleRows: 5,

  // Momentum decays the way UIScrollView's does: velocity keeps this fraction
  // of itself every millisecond. It is the single knob for feel — lower stops
  // sooner and travels less, higher coasts longer and further. Both the
  // distance and the duration follow from it, which is the point: a harder
  // throw goes further *and* runs longer, instead of being cut off.
  //   0.9950 — short and snappy
  //   0.9975 — close to iOS
  //   0.9990 — very long, glassy
  decelerationRate: 0.9975,

  // The coast ends once it has decayed to this speed (px/ms).
  restVelocity: 0.04,

  // Under this a release is a drag, not a throw: it settles on the row it is
  // nearest instead of coasting. Too low and an ordinary slow drag flings.
  minFlingVelocity: 0.35,

  // How far past the first and last row the wheel can be pulled. The pull
  // approaches this and never reaches it, so the end reads as an end without
  // the wheel going dead under the finger.
  //
  // It cannot exceed two rows here, and that is geometry rather than taste:
  // the viewport is `visibleRows * itemHeight` with the pill at its centre, so
  // an overshoot beyond `(visibleRows - 1) / 2 * itemHeight` carries the last
  // row out of sight and the wheel is left blank. At 112 a hard scroll into
  // the end emptied it completely.
  overscroll: 68,
  bounceMs: 520,

  // How far a throw arriving at the end wants to sink into the band, per unit
  // of the speed it still has when it gets there (px per px/ms). It passes
  // through the band on the way, so it still saturates below `overscroll` —
  // this only decides how quickly it gets there. Driving it from the arrival
  // speed rather than the distance the throw had left is what keeps a gentle
  // arrival to a nudge: the leftover distance is large even for a soft throw,
  // so it sank almost as deep as a hard one.
  impactGive: 40,

  minSettleMs: 200,
  maxFlingMs: 2400,

  // Movement under this many pixels is a tap, which jumps by whole rows.
  tapSlop: 6,

  // A scroll moves the wheel pixel for pixel, exactly as a finger does, and is
  // released through the same code when it stops — so the hardest scroll and
  // the hardest throw do the same thing, and both meet the band at the ends.
  // A scroll has no equivalent of lifting a finger, so a gap this long is
  // taken as the end of one. Long enough not to fire between the frames of a
  // trackpad's momentum, short enough to feel like a release.
  scrollEndMs: 90,
} as const;

export const TIME_INPUT_PANEL = {
  // Read by the CSS transition and by the timer that keeps the rows mounted
  // long enough to animate out, so it is declared once here.
  durationMs: 400,
} as const;

export const WHEEL_TICK = {
  sound: true,
  haptics: true,
  // Amplitude, not perceived loudness: dividing this by three is about -9.5 dB,
  // which the ear reads as roughly half as loud rather than a third. Halving
  // the perceived loudness again would mean about 0.018.
  volume: 0.015,
  frequency: 1900,
  // Nine milliseconds is too brief for a phone speaker to physically respond
  // to at low amplitude; the cone barely moves before it is told to stop.
  durationMs: 20,

  // A fast fling crosses detents faster than a click can be heard as separate
  // clicks, and stacking oscillators that quickly just buzzes.
  minIntervalMs: 28,
} as const;
