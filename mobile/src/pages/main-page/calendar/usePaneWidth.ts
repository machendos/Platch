import type { RefObject } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import { schedulerAreaWidth } from './layoutConfig';
import { settleDaysPerRow } from './calendarLayout';

// Measures the calendar pane and reports how many day columns fit in a row.
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

  const fits = settleDaysPerRow(
    schedulerAreaWidth(paneWidth),
    settledFits.current,
  );
  settledFits.current = fits;

  return { paneWidth, columnsPerRow: fits };
};
