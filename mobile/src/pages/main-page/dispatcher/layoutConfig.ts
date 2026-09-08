/* Every number the dispatcher decides for itself: the section chrome, the shape
   of a project row, and the three gestures a row takes part in.
 *
 * Values both the layout maths and the stylesheets need reach CSS through
 * `dispatcherCssVariables`, which the page shell applies — see
 * `../layout-config.ts`. Nothing here is restated in a stylesheet.
 */

export const DISPATCHER_SECTION_HEADER_HEIGHT = 36;

export const PROJECT_ROW_MIN_HEIGHT = 48;
export const PROJECT_ROW_GAP = 6;

export const PROJECT_INDENT_STEP = 24;

export const PROJECT_STRIP_WIDTH = 8;
export const PROJECT_STRIP_WIDTH_INHERITED = 2;

export const PROJECT_MENU_TRIGGER_SIZE = 28;

export const PROJECT_CONSEQUENCE_LINE_HEIGHT = 2;
export const PROJECT_CONSEQUENCE_DOT_SIZE = 8;

export const PROJECT_ROW_DRAGGING_OPACITY = 0.75;

export const PROJECT_DROP_GAP = 12;

/* What separates a long press from a flick. dnd-kit is configured with these in
   ProjectDragProvider, and the swipe reads the same two to stay on the other
   side of the same boundary — written twice they would drift, and the failure is
   silent: a touch that is both a drag and a swipe. */
export const DRAG_TOUCH_DELAY_MS = 250;
export const DRAG_TOUCH_TOLERANCE_PX = 8;

/* A row is swiped sideways to change its category.

   The lock distance is deliberately dnd-kit's tolerance and not a number of its
   own. Below it, the drag is still pending: claiming the touch any earlier means
   a finger that stops after the swipe has started still trips the long press, and
   the row is dragged and swiped at once. Equal is the earliest that is safe.
   Above 1 on purpose, matching the calendar: scrolling is the common intent, and
   wrongly stealing it is worse than missing a swipe. */
export const PROJECT_SWIPE_LOCK_DISTANCE = DRAG_TOUCH_TOLERANCE_PX;
export const PROJECT_SWIPE_LOCK_RATIO = 1.2;

/* How far the row travels before releasing commits. A fraction of the row so it
   scales with the pane, clamped because the dispatcher can be dragged down to
   DISPATCHER_MIN_PANE_WIDTH, where four tenths of a row is a twitch. */
export const PROJECT_SWIPE_FRACTION = 0.4;
export const PROJECT_SWIPE_MIN_DISTANCE = 56;
export const PROJECT_SWIPE_MAX_DISTANCE = 200;

/* Coming back and leaving are not the same motion, and one duration for both
   made the cancel feel like a snap. Returning is unhurried — nothing happened,
   so nothing needs to feel decided. Leaving is brisk, because the row is on its
   way somewhere and the space it frees has its own animation to get on with.

   The gesture needs both numbers too — it sends the move once the row has
   finished travelling — so they reach CSS as properties rather than being
   written twice. */
export const PROJECT_SWIPE_RETURN_MS = 340;
export const PROJECT_SWIPE_EXIT_MS = 180;

/* A landed project wipes in from its top edge, and a subtree unfolds row by row
   behind it. The stagger is what makes it read as one tree arriving rather than
   several rows blinking at once.

   The cascade is a budget, not a per-row cost: a big subtree tightens its
   stagger to fit rather than taking a second per ten rows. Small ones never
   reach the budget and keep the full step. */
export const PROJECT_REVEAL_DURATION_MS = 220;
export const PROJECT_REVEAL_STAGGER_MS = 45;
export const PROJECT_REVEAL_CASCADE_MS = 300;

export const revealStagger = (rowCount: number) =>
  rowCount < 2
    ? 0
    : Math.min(
        PROJECT_REVEAL_STAGGER_MS,
        PROJECT_REVEAL_CASCADE_MS / (rowCount - 1),
      );

export const dispatcherCssVariables = {
  '--section-header-height': `${DISPATCHER_SECTION_HEADER_HEIGHT}px`,
  '--project-row-min-height': `${PROJECT_ROW_MIN_HEIGHT}px`,
  '--project-row-gap': `${PROJECT_ROW_GAP}px`,
  '--project-indent-step': `${PROJECT_INDENT_STEP}px`,
  '--project-strip-width': `${PROJECT_STRIP_WIDTH}px`,
  '--project-strip-width-inherited': `${PROJECT_STRIP_WIDTH_INHERITED}px`,
  '--project-consequence-line-height': `${PROJECT_CONSEQUENCE_LINE_HEIGHT}px`,
  '--project-consequence-dot-size': `${PROJECT_CONSEQUENCE_DOT_SIZE}px`,
  '--project-row-dragging-opacity': `${PROJECT_ROW_DRAGGING_OPACITY}`,
  '--project-drop-gap': `${PROJECT_DROP_GAP}px`,
  '--project-reveal-duration': `${PROJECT_REVEAL_DURATION_MS}ms`,
  '--project-swipe-return': `${PROJECT_SWIPE_RETURN_MS}ms`,
  '--project-swipe-exit': `${PROJECT_SWIPE_EXIT_MS}ms`,
};
