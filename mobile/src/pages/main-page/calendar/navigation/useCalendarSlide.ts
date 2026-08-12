import { useEffect, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { Temporal } from 'temporal-polyfill';
import {
  clearPageOffset,
  easePageOffsetTo,
  holdPageOffset,
  settlePageOffset,
} from './pageOffset';
import { SLIDE_DISTANCE, SLIDE_DURATION_MS } from '../layoutConfig';

/**
 * Plays a short slide whenever the page changes.
 *
 * The content is already correct before the slide starts — React has swapped
 * the dates on the instances that were mounted, so nothing is waiting to load
 * and there is nothing to fade in.
 *
 * Navigating again while a slide is running cancels it and swaps outright, so
 * holding down an arrow (or swiping repeatedly) replaces pages briskly instead
 * of queueing animations behind each other.
 */
export const useCalendarSlide = (
  containerRef: RefObject<HTMLElement | null>,
  pageStart: Temporal.PlainDate,
) => {
  const previousStart = useRef(pageStart);
  const timer = useRef(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const before = previousStart.current;
    previousStart.current = pageStart;
    const direction = Temporal.PlainDate.compare(pageStart, before);
    if (direction === 0) return;

    // Clear whatever the last slide left behind. Note this effect deliberately
    // returns no cleanup: React would run it between renders and wipe
    // `timer`, and a slide still running is the only way to recognise rapid
    // navigation on the next change.
    const wasSliding = timer.current !== 0;
    window.clearTimeout(timer.current);
    timer.current = 0;
    clearPageOffset(container);

    if (wasSliding) return;

    // A swipe leaves the columns pulled toward the finger; the new page starts
    // from the opposite side regardless, so the flip lands on the same frame
    // the content changes and reads as one page leaving and another arriving.
    holdPageOffset(container, direction > 0 ? SLIDE_DISTANCE : -SLIDE_DISTANCE);
    easePageOffsetTo(container, 0);

    timer.current = window.setTimeout(() => {
      timer.current = 0;
      settlePageOffset(container);
    }, SLIDE_DURATION_MS);
  }, [containerRef, pageStart]);

  // Only on unmount — see the note above about not clearing between renders.
  useEffect(() => () => window.clearTimeout(timer.current), []);
};
