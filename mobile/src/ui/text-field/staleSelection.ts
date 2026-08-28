/* A selection left behind in a field that no longer has focus is not just
   untidy — on iOS it strands the Cut/Copy/Paste callout on screen, and tapping
   the highlighted text to get back in re-raises the callout instead of putting
   the caret back. The field is then only reachable by tapping text *outside*
   the old selection, which nobody would guess.

   Dropping the selection once focus has genuinely gone costs nothing: the user
   is no longer editing, so there is no selection worth preserving. */
export const dropSelectionInside = (root: HTMLElement | null | undefined) => {
  if (!root) return;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

  if (selection.anchorNode && root.contains(selection.anchorNode)) {
    selection.removeAllRanges();
  }
};
