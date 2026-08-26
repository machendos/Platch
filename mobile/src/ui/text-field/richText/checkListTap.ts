/* Where a tap has to land to count as hitting a checkbox.

   Lexical's own answer is `clickAreaPadding = isTouchEvent ? 32 : 0`, hard
   coded. The marker is 20px wide and the text begins 28px in, so on touch its
   zone runs to 52px and swallows the first two dozen pixels of the text — on a
   short line that is most of the word. Tapping to put the caret in your own
   text toggled the checkbox instead.

   The padding here is bounded by the gap rather than chosen for comfort: it
   may not reach the text, so it stops 4px short of where the text starts. That
   makes the target smaller than the 44px Apple asks for, which is the honest
   cost of a marker this size — the alternative is a target that steals taps
   meant for the words. */
export const MARKER_TAP_PAD = 4;

/** Vertically forgiving: anywhere on the line is fine, only x decides. */
export const isMarkerTap = (
  clientX: number,
  item: DOMRect,
  markerWidth: number,
) =>
  clientX >= item.left - MARKER_TAP_PAD &&
  clientX <= item.left + markerWidth + MARKER_TAP_PAD;
