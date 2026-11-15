import './press.css';

import type { PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { pressHaptic } from '../../../system/feedback/pressHaptic';

/* The only part of the press that cannot be CSS.

   `:active` ends the instant the finger lifts, and the press animates IN over
   about 150ms — so on a quick tap the state would be gone long before the
   animation had played. This holds it on for a floor of 140ms so the way down
   always completes, and decides when a gesture is a press at all. Everything
   else — both fills, both scales, every curve, depth and duration — is in
   press.css, keyed off the `data-pressed` this produces. */

export const MIN_PRESS_MS = 140;

/* A finger that is starting a scroll is indistinguishable from one starting a
   tap for the first few milliseconds, so on touch the press waits before it
   shows. Short enough to feel immediate on a real tap, long enough that a
   flick down the list never lights a row. A mouse cannot scroll by pressing,
   so it answers at once. */
const ARM_DELAY_MS = 50;

/* Past this the gesture is a scroll or a drag and the press is abandoned —
   the same distance dnd-kit and the row swipe use to tell those apart. */
const MOVE_CANCEL_PX = 8;

export const usePress = ({ enabled = true, haptic = true } = {}) => {
  const [pressed, setPressed] = useState(false);
  const [tracking, setTracking] = useState(false);
  const origin = useRef({ x: 0, y: 0 });
  const pressedAt = useRef(0);
  const armTimer = useRef<number | null>(null);
  const releaseTimer = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (armTimer.current !== null) {
      clearTimeout(armTimer.current);
      armTimer.current = null;
    }
    if (releaseTimer.current !== null) {
      clearTimeout(releaseTimer.current);
      releaseTimer.current = null;
    }
  }, []);

  const engage = useCallback(() => {
    pressedAt.current = performance.now();
    setPressed(true);
    /* Fired here rather than on pointerdown: a scroll must not buzz. */
    if (haptic) pressHaptic();
  }, [haptic]);

  const cancel = useCallback(() => {
    clearTimers();
    setTracking(false);
    setPressed(false);
  }, [clearTimers]);

  const finish = useCallback(() => {
    setTracking(false);
    if (armTimer.current !== null) {
      /* Lifted before it armed, without moving — that is a real tap, and the
         shortest ones are the ones most in need of feedback. Play it now. */
      clearTimeout(armTimer.current);
      armTimer.current = null;
      engage();
    }
    if (releaseTimer.current !== null) return;
    const left = MIN_PRESS_MS - (performance.now() - pressedAt.current);
    if (left <= 0) {
      setPressed(false);
      return;
    }
    releaseTimer.current = window.setTimeout(() => {
      releaseTimer.current = null;
      setPressed(false);
    }, left);
  }, [engage]);

  /* Armed on the window, and in the CAPTURE phase, which is not a detail:
     dnd-kit's pointer sensor calls stopPropagation() on the release that ends
     a drag, so a bubble-phase listener never runs and the press stays latched
     — the dragged row came back shrunk, and every later drag added another. */
  useEffect(() => {
    if (!tracking) return undefined;
    const options = { capture: true } as const;
    const onMove = (event: PointerEvent) => {
      const dx = event.clientX - origin.current.x;
      const dy = event.clientY - origin.current.y;
      if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) cancel();
    };
    window.addEventListener('pointermove', onMove, options);
    window.addEventListener('pointerup', finish, options);
    window.addEventListener('pointercancel', cancel, options);
    return () => {
      window.removeEventListener('pointermove', onMove, options);
      window.removeEventListener('pointerup', finish, options);
      window.removeEventListener('pointercancel', cancel, options);
    };
  }, [tracking, cancel, finish]);

  /* Going inert mid-press must LOSE the press, not just stop drawing it. A row
     the drag has taken over sets `enabled` false; if the boolean survived, the
     row would light again the moment the drag handed it back. */
  useEffect(() => {
    if (!enabled) cancel();
  }, [enabled, cancel]);

  useEffect(() => clearTimers, [clearTimers]);

  const hold = (event: ReactPointerEvent<HTMLElement>) => {
    if (!enabled) return;
    clearTimers();
    origin.current = { x: event.clientX, y: event.clientY };
    setTracking(true);
    if (event.pointerType === 'touch') {
      armTimer.current = window.setTimeout(() => {
        armTimer.current = null;
        engage();
      }, ARM_DELAY_MS);
      return;
    }
    engage();
  };

  return { pressed: pressed && enabled, hold };
};
