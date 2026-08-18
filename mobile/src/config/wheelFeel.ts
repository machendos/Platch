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

  // How far past the first and last row the wheel can be dragged. The pull
  // approaches this and never reaches it, so the end reads as an end without
  // the wheel going dead under the finger.
  overscroll: 112,
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

  // Delta that adds up to one row. A mouse notch reports about this much, so a
  // notch is a row; a trackpad sends far smaller deltas that accumulate into
  // one. Whole rows only, animated over wheelStepMs — following the delta
  // continuously meant a notch jumped a row with no motion at all, and a
  // trackpad flipped the selection at the halfway point between two rows.
  wheelStepPx: 100,
  wheelStepMs: 170,

  // Scrolling has no momentum of its own — every notch costs the same, so
  // crossing a long list took dozens of them where one throw would do. Faster
  // scrolling covers more ground per notch, the way a native scroller
  // accelerates: below `wheelGainFrom` a notch is exactly one row and stays
  // precise for picking, above it the gain climbs to `wheelGainMax`.
  //
  // The ceiling is deliberately low. A trackpad's momentum phase already sends
  // dozens of events after the fingers lift, so gain multiplies something that
  // is long to begin with — at 8 a single hard flick crossed a 181-row wheel
  // twice over.
  wheelGainFrom: 1,
  wheelGainMax: 2,
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
