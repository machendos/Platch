// How far the columns are pushed sideways, and how that offset is applied.
// Both the drag and the page-change slide write it, so the class names and the
// custom property live in one place rather than being poked from two hooks.

const OFFSET_PROPERTY = '--calendar-page-slide';
// Offset applied, no transition: the finger is in charge.
const HELD_CLASS = 'calendar-page-held';
// Offset applied, with a transition: the finger has let go.
const EASING_CLASS = 'calendar-sliding';

/** Put the columns at `px` immediately, with no animation. */
export const holdPageOffset = (container: HTMLElement, px: number) => {
  container.classList.remove(EASING_CLASS);
  container.classList.add(HELD_CLASS);
  container.style.setProperty(OFFSET_PROPERTY, `${px}px`);
};

/**
 * Animate from wherever the columns are to `px`.
 *
 * The current offset has to be committed before the transition is switched on,
 * or there is nothing to animate from. A forced reflow does that, rather than
 * waiting a frame: `requestAnimationFrame` does not run while the page is
 * hidden, which would strand the calendar mid-offset.
 */
export const easePageOffsetTo = (container: HTMLElement, px: number) => {
  void container.offsetWidth;
  container.classList.remove(HELD_CLASS);
  container.classList.add(EASING_CLASS);
  container.style.setProperty(OFFSET_PROPERTY, `${px}px`);
};

/** Back to no transform at all — the resting state pinch-to-zoom expects. */
export const clearPageOffset = (container: HTMLElement) => {
  container.classList.remove(HELD_CLASS, EASING_CLASS);
  container.style.setProperty(OFFSET_PROPERTY, '0px');
};

/** Drop only the transition, leaving the offset where it is. */
export const settlePageOffset = (container: HTMLElement) =>
  container.classList.remove(EASING_CLASS);

/**
 * Whether a slide is playing right now.
 *
 * Lets anything that wants to follow a page change wait its turn without
 * needing to know the page changed — or the class name it is asking about.
 */
export const isPageSliding = (container: HTMLElement) =>
  container.classList.contains(EASING_CLASS);

/**
 * Takes the scroller out of the browser's hands.
 *
 * iOS decides a touch is a scroll before we can classify it. Once it has
 * committed, `touchmove` arrives non-cancelable, `preventDefault()` is ignored,
 * and the compositor keeps scrolling on its own thread — overriding whatever we
 * write. Making the element non-scrollable ends that: there is nothing left for
 * the compositor to scroll, while `scrollTop` stays writable from script.
 *
 * Used by both the pinch and the sideways drag.
 */
export const setScrollLocked = (container: HTMLElement, locked: boolean) => {
  const { scrollTop } = container;
  container.style.overflow = locked ? 'hidden' : '';
  // Toggling overflow can reset the offset, so put it back.
  container.scrollTop = scrollTop;
};
