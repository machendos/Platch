import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { PRESS_FEEL } from '../../config/pressFeel';

/* The half of a press that is not visible, and the half a hand notices first.
   It sits here rather than in usePress so that every haptic the app fires is
   in one directory with its switches in one config — tickSound's `bump` is the
   other one. Web is a no-op: iOS Safari has no navigator.vibrate, so the
   plugin's fallback reaches nothing. */

let lastAt = 0;

export const pressHaptic = () => {
  if (!PRESS_FEEL.haptics) return;
  if (!Capacitor.isNativePlatform()) return;

  const now = performance.now();
  if (now - lastAt < PRESS_FEEL.minIntervalMs) return;
  lastAt = now;

  void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
};
