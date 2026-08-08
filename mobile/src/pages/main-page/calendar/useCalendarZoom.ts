import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { clamp } from '../../../common/helpers';

// Height of one time cell at 100% zoom, and the hard ceiling/floor pinching
// can reach. The working minimum is usually larger — see minCellHeight below.
export const BASE_CELL_HEIGHT = 25;
// A time label is one line tall (1.6em of a 10px font ≈ 16px). Let cells get
// shorter than that and consecutive labels overlap each other, since each one
// is taller than the cell it belongs to. Raising the label density instead —
// showing every second or third hour as cells shrink, via timeLabelStep — is
// what would let this go lower.
const ABSOLUTE_MIN_CELL_HEIGHT = 16;
const MAX_CELL_HEIGHT = 120;

// One per row: the block whose height is purely time cells, with no header
// mixed in. Everything else in the stack keeps a fixed height while zooming.
const SCALING_BLOCK_SELECTOR = '.mbsc-schedule-column-inner';
const CALENDAR_ROW_SELECTOR = '.calendar-week-row';

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

const readCellHeight = (container: HTMLElement) =>
  parseFloat(
    getComputedStyle(container).getPropertyValue('--calendar-cell-height'),
  ) || BASE_CELL_HEIGHT;

/**
 * Smallest cell height worth allowing: the one where the whole stack exactly
 * fills the pane. Zooming out past it would only add empty space below the
 * last row.
 *
 * The content is affine in cell height (`fixed + cells * height`), so the
 * scaling and fixed parts are separated first. With enough rows the ideal
 * value drops below readability, hence the absolute floor — past that point
 * the stack simply keeps scrolling.
 */
const minCellHeight = (container: HTMLElement) => {
  const rows = [
    ...container.querySelectorAll<HTMLElement>(CALENDAR_ROW_SELECTOR),
  ];
  const blocks = scalingBlocks(container);
  if (!rows.length || !blocks.length) return ABSOLUTE_MIN_CELL_HEIGHT;

  const scalingNow = blocks.reduce(
    (sum, block) => sum + block.getBoundingClientRect().height,
    0,
  );
  const cellsTotal = scalingNow / readCellHeight(container);
  if (!cellsTotal) return ABSOLUTE_MIN_CELL_HEIGHT;

  const style = getComputedStyle(container);
  const padding =
    parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  const contentHeight =
    rows[rows.length - 1].getBoundingClientRect().bottom -
    rows[0].getBoundingClientRect().top +
    padding;

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

  // Fewer rows means the stack needs taller cells to still fill the pane, so
  // a layout change can leave the current zoom below the new limit.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const minimum = minCellHeight(container);
    setCellHeight((current) => (current < minimum ? minimum : current));
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
      gesture.current.minHeight = minCellHeight(container);
      return height;
    };

    const applyZoom = (height: number, anchorY: number) => {
      container.style.setProperty('--calendar-cell-height', `${height}px`);
      const { fixedAbove, cellsAbove } = gesture.current;
      container.scrollTop = fixedAbove + cellsAbove * height - anchorY;
      gesture.current.height = height;
    };

    /**
     * Takes the surface out of the browser's hands for the duration of a
     * pinch.
     *
     * iOS decides whether a touch is a scroll before it can know a second
     * finger is coming. Once it has committed, touchmove arrives
     * non-cancelable, preventDefault() is ignored, and the compositor keeps
     * scrolling on its own thread — overriding whatever we write. Making the
     * element non-scrollable ends that: there is nothing left for the
     * compositor to scroll, while scrollTop stays writable from script.
     */
    const setScrollLocked = (locked: boolean) => {
      const { scrollTop } = container;
      container.style.overflow = locked ? 'hidden' : '';
      // Toggling overflow can reset the offset, so put it back.
      container.scrollTop = scrollTop;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const distance = touchDistance(e.touches);
      // Two fingers landing on the exact same spot would make the scale
      // ratio meaningless (and divide by ~zero).
      if (distance < 1) return;

      setScrollLocked(true);
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
      setScrollLocked(false);
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
