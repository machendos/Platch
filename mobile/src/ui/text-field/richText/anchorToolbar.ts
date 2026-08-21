/* The toolbar sits above the field it is editing, and stays put when that
   field is taller than the screen. Attached to the field's top edge and
   nothing else, a long context scrolls its own toolbar out of reach exactly
   when the buttons are most wanted.

   So it is clamped rather than pinned: it prefers to sit above the field, it
   never rises past the top of the scrolling area, and it never outlives the
   field — once the field's bottom passes, the toolbar leaves with it instead
   of hanging over whatever comes next.

   It stays absolutely positioned inside the field throughout, so it remains
   out of flow and appearing still shifts nothing. `position: fixed` is not an
   option: inside ion-content a transformed ancestor makes it resolve against
   the scroller rather than the viewport, so it scrolls away regardless. */

/** Space between the toolbar and the field's top edge. */
export const TOOLBAR_GAP = 4;

/** Space kept between the toolbar and the top of the scrolling area. */
export const TOOLBAR_CEILING_GAP = 4;

export const toolbarTopWithin = (
  field: DOMRect,
  ceiling: number,
  toolbarHeight: number,
) => {
  const above = field.top - TOOLBAR_GAP - toolbarHeight;
  const lowest = field.bottom - toolbarHeight;

  /* The floor wins over the ceiling, and the order of these two operations is
     what decides that. Once the field's bottom has climbed past the ceiling
     the toolbar goes off with it, rather than staying pinned to the top of a
     field that is no longer there — a toolbar hanging over the next field
     would be worse than one briefly poking above the scrolling area. */
  const clamped = Math.min(Math.max(above, ceiling), lowest);

  // Returned relative to the field, because that is what it is positioned in.
  return clamped - field.top;
};

/** The visible top of whatever the field scrolls inside. */
export const ceilingFor = (field: HTMLElement) => {
  const content = field.closest('ion-content');
  const top = content ? content.getBoundingClientRect().top : 0;
  return top + TOOLBAR_CEILING_GAP;
};

/* ion-content scrolls in its shadow root, so the element that actually emits
   scroll events cannot be reached with closest(). Ionic hands it over, but
   only asynchronously. */
export const scrollerFor = async (field: HTMLElement): Promise<EventTarget> => {
  const content = field.closest('ion-content');
  if (!content) return window;

  const withScroller = content as HTMLElement & {
    getScrollElement?: () => Promise<HTMLElement>;
  };
  if (!withScroller.getScrollElement) return window;

  return withScroller.getScrollElement();
};
