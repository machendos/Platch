import type { RefObject } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import {
  CALENDAR_MIN_COLUMN_WIDTH,
  CALENDAR_PANE_PADDING,
  CALENDAR_TIME_GUTTER_WIDTH,
  WRAP_HYSTERESIS,
} from '../layout-constants';
import { daysPerRowThatFit } from './calendarLayout';

// Measures the calendar pane and reports how many day columns fit in a row.
// `columnsPerRow` only moves once the pane has travelled past a boundary by
// `WRAP_HYSTERESIS`, so dragging the divider across a threshold settles
// rather than oscillating.
export const usePaneWidth = (containerRef: RefObject<HTMLElement | null>) => {
  const [paneWidth, setPaneWidth] = useState(0);
  const settledFits = useRef(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    setPaneWidth(container.clientWidth);
    const observer = new ResizeObserver(() =>
      setPaneWidth(container.clientWidth),
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef]);

  const measuredArea =
    paneWidth - CALENDAR_PANE_PADDING * 2 - CALENDAR_TIME_GUTTER_WIDTH;
  const rawFits = daysPerRowThatFit(measuredArea, CALENDAR_MIN_COLUMN_WIDTH);
  Math.max(1, Math.floor(measuredArea / CALENDAR_MIN_COLUMN_WIDTH));
  const previous = settledFits.current;

  const wideningBoundary =
    (previous + 1) * CALENDAR_MIN_COLUMN_WIDTH + WRAP_HYSTERESIS;

  const fits =
    previous && rawFits > previous && measuredArea < wideningBoundary
      ? previous
      : rawFits;
  settledFits.current = fits;

  return {
    paneWidth,
    schedulerArea: measuredArea,
    columnsPerRow: fits,
  };
};
