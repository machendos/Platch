export const PRESS_FEEL = {
  haptics: true,
  /* A press fires one impact where the wheel fires a stream of them, so this
     only has to swallow the double-taps and the repeat-presses a finger makes
     on one control. Shorter than WHEEL_TICK's interval for that reason. */
  minIntervalMs: 40,
} as const;
