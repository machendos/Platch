import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { WHEEL_TICK } from '../../config/wheelFeel';

let context: AudioContext | null = null;
let lastTickAt = 0;
let unlocked = false;

const audio = (): AudioContext | null => {
  if (context) return context;

  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!Ctor) return null;

  try {
    context = new Ctor();
    return context;
  } catch {
    return null;
  }
};

const click = () => {
  const ctx = audio();
  if (!ctx) return;

  // Deliberately not skipped while suspended. A suspended context freezes
  // currentTime, and scheduling a moment past it means the note plays as soon
  // as audio starts rather than being lost — where returning early here mutes
  // every tick outright if the context never reports `running`.
  if (ctx.state !== 'running') void ctx.resume();

  try {
    // Scheduling exactly at currentTime races the audio thread, which may have
    // already rendered past it.
    const start = ctx.currentTime + 0.001;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const seconds = WHEEL_TICK.durationMs / 1000;

    oscillator.type = 'triangle';
    oscillator.frequency.value = WHEEL_TICK.frequency;

    // Ramping the gain to nearly zero rather than switching the oscillator off
    // makes the burst read as a detent click instead of ringing like a beep.
    gain.gain.setValueAtTime(WHEEL_TICK.volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);

    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + seconds);
  } catch {
    // A tick is never worth interrupting a gesture for.
  }
};

// Haptics reach the hardware only in the native shell: iOS Safari has no
// navigator.vibrate, so the plugin's web fallback does nothing there.
const bump = () => {
  if (!Capacitor.isNativePlatform()) return;
  void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
};

// Call from a real gesture handler before the first tick. iOS only lets an
// AudioContext start inside a user gesture, and the first tick arrives from a
// pointermove or an animation frame, neither of which counts as one. Playing an
// empty buffer here is the long-standing way to get WebKit to release it.
export const armTicks = () => {
  const ctx = audio();
  if (!ctx) return;

  if (ctx.state !== 'running') void ctx.resume();
  if (unlocked) return;

  try {
    const source = ctx.createBufferSource();
    source.buffer = ctx.createBuffer(1, 1, 22050);
    source.connect(ctx.destination);
    source.start(0);
    unlocked = true;
  } catch {
    // Left locked; the next gesture tries again.
  }
};

export const tick = () => {
  const now = performance.now();
  if (now - lastTickAt < WHEEL_TICK.minIntervalMs) return;
  lastTickAt = now;

  if (WHEEL_TICK.sound) click();
  if (WHEEL_TICK.haptics) bump();
};
