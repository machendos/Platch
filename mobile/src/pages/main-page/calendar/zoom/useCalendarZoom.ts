import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { clamp } from '../../../../system/helpers/helpers';
import { setScrollLocked } from '../navigation/pageOffset';
import { ABSOLUTE_MIN_CELL_HEIGHT } from '../layoutConfig';

// One cell is one hour, always: mobiscroll's `timeCellStep` never changes, so
// nothing can redefine the unit underneath the gesture. The half-hour line and
// the thinning of labels are drawn from this number in CSS — see zoom-detail.ts
// — rather than by asking mobiscroll to re-render at a finer step.
const BASE_CELL_HEIGHT = 25;
const MAX_CELL_HEIGHT = 120;

// One per row: the block whose height is purely time cells, with no header
// mixed in. Everything else in the stack keeps a fixed height while zooming.
const SCALING_BLOCK_SELECTOR = '.mbsc-schedule-column-inner';
const CALENDAR_ROW_SELECTOR = '.calendar-week-row';
// Grid drawn past the last row to clear the home indicator. It sits after the
// rows rather than inside one, so the span between them does not include it.
const BOTTOM_STRIP_SELECTOR = '.calendar-bottom-strip';

const touchDistance = (touches: TouchList) =>
  Math.hypot(
    touches[0].clientX - touches[1].clientX,
    touches[0].clientY - touches[1].clientY,
  );

const touchMidpointY = (touches: TouchList) =>
  (touches[0].clientY + touches[1].clientY) / 2;

const scalingBlocks = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>(CALENDAR_ROW_SELECTOR)]
    .map((row) => row.querySelector<HTMLElement>(SCALING_BLOCK_SELECTOR))
    .filter((block): block is HTMLElement => !!block);

// Unitless on purpose. CSS cannot divide a length to get a number, so the
// thresholds in zoom-detail.ts could not be compared against a px value; the
// length is derived back in Calendar.css.
const readCellHeight = (container: HTMLElement) =>
  parseFloat(
    getComputedStyle(container).getPropertyValue('--calendar-cell-px'),
  ) || BASE_CELL_HEIGHT;

/**
 * Cell height at which the whole stack exactly fills the pane: the smallest
 * worth allowing, since zooming out past it would only add empty space below
 * the last row, and the one to snap to when the layout changes shape.
 *
 * The content is affine in cell height (`fixed + cells * height`), so the
 * scaling and fixed parts are separated first. With enough rows the ideal
 * value drops below what labels can survive, hence the floor — past that point
 * the stack simply keeps scrolling.
 *
 * `null` means "cannot be measured yet", which is not the same as a small
 * result and must not be collapsed into one. Mobiscroll settles
 * asynchronously, so on the first layout the scaling blocks are still 0-high;
 * a caller that applied a fallback floor here would pin the grid to 8px cells.
 * Callers retry instead — the ResizeObserver below fires once the real heights
 * land.
 *
 * A *partial* layout is the trap, and it is worse than an empty one because it
 * measures cleanly. Every row must have a grid and every grid must have height
 * before the answer means anything: `cellsTotal` is a sum, so one row of two
 * still rendering reads as 21 cells rather than 42 and yields a fit close to
 * the current height — plausible, wrong, and enough to satisfy a caller that
 * only wanted one good measurement. Re-splitting the rows also changes
 * `size`, which the trial build answers with a round-trip of up to ~1.2s
 * before the second grid exists at all.
 */
const fitCellHeight = (container: HTMLElement): number | null => {
  const rows = [
    ...container.querySelectorAll<HTMLElement>(CALENDAR_ROW_SELECTOR),
  ];
  const blocks = scalingBlocks(container);
  // `scalingBlocks` drops rows whose grid is not mounted, so an unequal count
  // is precisely "some row has not rendered yet".
  if (!rows.length || blocks.length !== rows.length || !container.clientHeight)
    return null;

  const heights = blocks.map((block) => block.getBoundingClientRect().height);
  if (heights.some((height) => !height)) return null;

  const scalingNow = heights.reduce((sum, height) => sum + height, 0);
  const cellsTotal = scalingNow / readCellHeight(container);
  if (!cellsTotal) return null;

  const style = getComputedStyle(container);
  const padding =
    parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  // Counted explicitly: it is a sibling after the last row, so measuring the
  // span between the rows misses it, and the limit would settle a strip's
  // worth above the pane — leaving a residual scroll where fully zoomed out is
  // meant to fit exactly.
  const stripHeight =
    container
      .querySelector<HTMLElement>(BOTTOM_STRIP_SELECTOR)
      ?.getBoundingClientRect().height ?? 0;
  const contentHeight =
    rows[rows.length - 1].getBoundingClientRect().bottom -
    rows[0].getBoundingClientRect().top +
    padding +
    stripHeight;

  const fixedHeight = contentHeight - scalingNow;
  const fitAll = (container.clientHeight - fixedHeight) / cellsTotal;
  return clamp(fitAll, ABSOLUTE_MIN_CELL_HEIGHT, MAX_CELL_HEIGHT);
};

/**
 * Pinch to zoom the stacked rows by changing the height of one time cell.
 *
 * The rows form one continuous scrolling surface, and only part of it
 * scales: the time grids grow with the cell height while the month and day
 * headers between them stay put. So a position in the document is
 * `fixedAbove + cellsAbove * cellHeight` — affine, not proportional — and
 * both halves have to be tracked separately to keep the time under the
 * fingers from drifting.
 *
 * During a gesture the height is written straight to the DOM as a CSS
 * variable, keeping React and mobiscroll out of the per-frame path. The
 * final value is committed to state when the gesture ends.
 *
 * Detail that depends on the height — the half-hour line, thinning the labels
 * — is derived from the same variable in CSS, so it tracks the gesture frame
 * by frame instead of waiting for that commit.
 *
 * `layoutSignature` should change whenever the row split or visible hours
 * change, so the zoom-out limit can be recomputed for the new shape.
 */
export const useCalendarZoom = (
  containerRef: RefObject<HTMLDivElement | null>,
  layoutSignature: string,
) => {
  const [cellHeight, setCellHeight] = useState(BASE_CELL_HEIGHT);

  // What the gesture was anchored to when it began. Every frame is computed
  // from this snapshot rather than from the previous frame, so a single bad
  // frame cannot bend the rest of the gesture.
  const gesture = useRef({
    startDistance: 0,
    startHeight: 0,
    fixedAbove: 0,
    cellsAbove: 0,
    height: 0,
    minHeight: ABSOLUTE_MIN_CELL_HEIGHT,
  });

  // Set while a fit is owed: on mount, and whenever the row split or the
  // visible hours change. The next measurable layout is then snapped to the
  // exact fit rather than merely floored, which is what zooms the stack out to
  // show the whole of a newly wrapped layout.
  const wantsExactFit = useRef(true);

  // The stack must never occupy less than the pane. Enforcing that on render
  // alone does not work: mobiscroll settles asynchronously, so the layout this
  // runs against on mount is still 0-high and unmeasurable, and by the time it
  // is real nothing re-renders. Hence the observer — it is the only signal that
  // the geometry has actually landed.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    wantsExactFit.current = true;

    const applyFit = () => {
      // A pinch owns the height while it runs; a resize landing mid-gesture
      // would otherwise yank the cells out from under the fingers.
      if (gesture.current.startDistance) return;

      const fit = fitCellHeight(container);
      if (fit === null) return; // still settling — a later callback retries

      if (wantsExactFit.current) {
        wantsExactFit.current = false;
        setCellHeight(fit);
      } else {
        setCellHeight((current) => (current < fit ? fit : current));
      }
    };

    applyFit();

    // Watching the rows as well as the pane looks like a feedback loop —
    // applying a fit resizes the very rows being observed — but it settles in
    // one pass. `fitCellHeight` is scale-invariant: `cellsTotal` is the same 21
    // whether cells are 25px or 32px, so the second callback recomputes the
    // same number, the write is a no-op, and React bails on identical state.
    const observer = new ResizeObserver(applyFit);
    observer.observe(container);
    for (const row of container.querySelectorAll<HTMLElement>(
      CALENDAR_ROW_SELECTOR,
    )) {
      observer.observe(row);
    }
    return () => observer.disconnect();
  }, [containerRef, layoutSignature]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measureAnchor = (contentY: number, height: number) => {
      const containerTop = container.getBoundingClientRect().top;
      let scaledAbove = 0;
      for (const block of scalingBlocks(container)) {
        const rect = block.getBoundingClientRect();
        const top = rect.top - containerTop + container.scrollTop;
        if (contentY >= top + rect.height) scaledAbove += rect.height;
        else if (contentY > top) scaledAbove += contentY - top;
      }
      return {
        fixedAbove: contentY - scaledAbove,
        cellsAbove: scaledAbove / height,
      };
    };

    const beginGesture = (anchorY: number) => {
      const height = readCellHeight(container);
      const anchor = measureAnchor(container.scrollTop + anchorY, height);
      gesture.current.startHeight = height;
      gesture.current.height = height;
      gesture.current.fixedAbove = anchor.fixedAbove;
      gesture.current.cellsAbove = anchor.cellsAbove;
      gesture.current.minHeight =
        fitCellHeight(container) ?? ABSOLUTE_MIN_CELL_HEIGHT;
      return height;
    };

    const applyZoom = (height: number, anchorY: number) => {
      container.style.setProperty('--calendar-cell-px', `${height}`);
      const { fixedAbove, cellsAbove } = gesture.current;
      container.scrollTop = fixedAbove + cellsAbove * height - anchorY;
      gesture.current.height = height;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const distance = touchDistance(e.touches);
      // Two fingers landing on the exact same spot would make the scale
      // ratio meaningless (and divide by ~zero).
      if (distance < 1) return;

      setScrollLocked(container, true);
      beginGesture(
        touchMidpointY(e.touches) - container.getBoundingClientRect().top,
      );
      gesture.current.startDistance = distance;
    };

    const onTouchMove = (e: TouchEvent) => {
      const { startDistance, startHeight, minHeight } = gesture.current;
      if (e.touches.length !== 2 || !startDistance) return;

      // Stops the surface panning natively and the page zooming mid-pinch,
      // whenever iOS has not already committed to a scroll. Only possible
      // because the listener is registered non-passive below.
      e.preventDefault();

      const scale = touchDistance(e.touches) / startDistance;
      const anchorY =
        touchMidpointY(e.touches) - container.getBoundingClientRect().top;
      applyZoom(
        clamp(startHeight * scale, minHeight, MAX_CELL_HEIGHT),
        anchorY,
      );
    };

    const onTouchEnd = () => {
      // Only unwind a pinch we actually started — touching the scroller after
      // an ordinary one-finger scroll would cut its momentum short.
      if (!gesture.current.startDistance) return;
      setScrollLocked(container, false);
      gesture.current.startDistance = 0;
      setCellHeight(gesture.current.height);
    };

    // Browsers report a trackpad pinch as a wheel event with ctrlKey set.
    // Each tick is its own small gesture, so it re-anchors every time.
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();

      const anchorY = e.clientY - container.getBoundingClientRect().top;
      const height = beginGesture(anchorY);
      applyZoom(
        clamp(
          height * (1 - e.deltaY / 100),
          gesture.current.minHeight,
          MAX_CELL_HEIGHT,
        ),
        anchorY,
      );
      setCellHeight(gesture.current.height);
    };

    // Registered here rather than through React's onTouchMove/onWheel props:
    // React attaches those passively, which makes preventDefault() a no-op.
    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
    container.addEventListener('touchcancel', onTouchEnd);
    container.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
      container.removeEventListener('wheel', onWheel);
    };
  }, [containerRef]);

  return { cellHeight };
};
