import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { clamp } from '../../../../common/helpers';
import {
  easePageOffsetTo,
  holdPageOffset,
  clearPageOffset,
  setScrollLocked,
} from './pageOffset';
import {
  DAMPING,
  LOCK_DISTANCE,
  LOCK_RATIO,
  MAX_NUDGE,
  SLIDE_DURATION_MS,
  swipeThreshold,
} from '../layoutConfig';

type Axis = 'undecided' | 'horizontal' | 'vertical';

/**
 * Swipe sideways to change page.
 *
 * The gesture commits to one axis early and keeps it. A sideways drag stops
 * the calendar scrolling for the rest of the touch — nobody swipes perfectly
 * horizontally, and letting the vertical drift through made every page turn
 * jog the calendar up or down.
 */
export const useCalendarSwipe = (
  containerRef: RefObject<HTMLElement | null>,
  onPageChange: (delta: number) => void,
) => {
  const change = useRef(onPageChange);
  change.current = onPageChange;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let axis: Axis = 'undecided';
    let startX = 0;
    let startY = 0;
    let threshold = 0;
    let settleTimer = 0;
    let multiTouch = false;

    const reset = () => {
      axis = 'undecided';
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        multiTouch = true;
        reset();
        return;
      }
      window.clearTimeout(settleTimer);
      reset();
      multiTouch = false;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      threshold = swipeThreshold(container.clientWidth);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (multiTouch || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      if (axis === 'undecided') {
        if (Math.hypot(dx, dy) < LOCK_DISTANCE) return;
        axis =
          Math.abs(dx) > Math.abs(dy) * LOCK_RATIO ? 'horizontal' : 'vertical';
        if (axis === 'horizontal') setScrollLocked(container, true);
      }

      if (axis !== 'horizontal') return;

      // Covers the case where iOS has not yet committed to a scroll; the
      // overflow lock above covers the case where it has.
      if (e.cancelable) e.preventDefault();
      holdPageOffset(container, clamp(dx / DAMPING, -MAX_NUDGE, MAX_NUDGE));
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length > 0) return;

      const wasHorizontal = axis === 'horizontal';
      multiTouch = false;
      reset();
      if (!wasHorizontal) return;

      setScrollLocked(container, false);

      const touch = e.changedTouches[0];
      const dx = touch ? touch.clientX - startX : 0;

      if (Math.abs(dx) >= threshold) {
        change.current(dx < 0 ? 1 : -1);
        return;
      }

      easePageOffsetTo(container, 0);
      settleTimer = window.setTimeout(
        () => clearPageOffset(container),
        SLIDE_DURATION_MS,
      );
    };

    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
    container.addEventListener('touchcancel', onTouchEnd);

    return () => {
      window.clearTimeout(settleTimer);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [containerRef]);
};
