/**
 * Takes a scroller out of the browser's hands.
 *
 * iOS decides a touch is a scroll before we can classify it. Once it has
 * committed, `touchmove` arrives non-cancelable, `preventDefault()` is ignored,
 * and the compositor keeps scrolling on its own thread — overriding whatever we
 * write. Making the element non-scrollable ends that: there is nothing left for
 * the compositor to scroll, while `scrollTop` stays writable from script.
 *
 * Used by the calendar's pinch and sideways drag, and by the dispatcher's row
 * swipe. Every caller pairs it with `preventDefault()`, which covers the case
 * where iOS has *not* yet committed; neither alone was enough.
 */
export const setScrollLocked = (container: HTMLElement, locked: boolean) => {
  const { scrollTop } = container;
  container.style.overflow = locked ? 'hidden' : '';
  // Toggling overflow can reset the offset, so put it back.
  container.scrollTop = scrollTop;
};
