import { useEffect } from 'react';
import type { RefObject } from 'react';
import { isPageSliding } from './pageOffset';
import {
  SLIDE_DURATION_MS,
  TODAY_SCROLL_OFFSET_FROM_SLIDE_END_MS,
} from '../layoutConfig';

const ROW_SELECTOR = '.calendar-week-row';
// Set by Calendar.tsx on the row whose range covers today
const TODAY_ROW_SELECTOR = '.calendar-week-row-has-today';

/**
 * Where the pane has to sit for today's row to be on show, or `null` when
 * there is nothing worth moving for.
 */
const revealOffset = (container: HTMLElement) => {
  const row = container.querySelector<HTMLElement>(TODAY_ROW_SELECTOR);
  if (!row) return null;

  const viewport = container.clientHeight;
  const { top, height } = row.getBoundingClientRect();
  const overflows = height > viewport;

  if (!overflows && container.querySelectorAll(ROW_SELECTOR).length === 1) {
    return null;
  }

  const rowTop =
    top - container.getBoundingClientRect().top + container.scrollTop;

  // A row taller than the pane cannot be centred: that would push its day
  // names and first hours off the top
  return overflows ? rowTop : rowTop - (viewport - height) / 2;
};

/**
 * Brings the row holding today into view when the user asks for it.
 *
 * `request` counts presses instead of naming a destination, because there is
 * no state change to react to otherwise: asking for today while today's page
 * is already showing leaves `pageStart` exactly as it was.
 *
 * Zoom is deliberately left alone. A row too tall for the pane is scrolled to,
 * never shrunk to fit — the cell height is the user's to set.
 */
export const useCalendarRevealToday = (
  containerRef: RefObject<HTMLElement | null>,
  request: number,
) => {
  useEffect(() => {
    if (request === 0) return;
    const container = containerRef.current;
    if (!container) return;

    const wait = isPageSliding(container)
      ? Math.max(0, SLIDE_DURATION_MS + TODAY_SCROLL_OFFSET_FROM_SLIDE_END_MS)
      : 0;

    const timer = window.setTimeout(() => {
      // Measured inside the timer rather than up front, so it reads whatever
      // layout is current when the scroll actually starts. A slide may still
      // be playing at that point, which does not matter: it translates
      // sideways, and everything read here is vertical.
      const top = revealOffset(container);
      if (top === null) return;

      // Handed to the browser's scroll animator instead of being driven frame
      // by frame. A rAF loop writing `scrollTop` is the pattern that loses to
      // the compositor on iOS (see the pinch in useCalendarZoom), and it stops
      // dead while the page is hidden — which would strand the calendar
      // part-way. A native smooth scroll survives both, and a touch cancels
      // it, which is exactly what should happen.
      container.scrollTo({ top, behavior: 'smooth' });
    }, wait);

    // Unlike the slide, this effect *should* clean up: its deps change only on
    // a new press, and a press arriving mid-wait supersedes the one before it.
    return () => window.clearTimeout(timer);
  }, [containerRef, request]);
};
