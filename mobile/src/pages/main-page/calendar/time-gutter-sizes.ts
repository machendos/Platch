// Mobiscroll steps its label font from 10px to 12px once the pane reaches
// roughly this width. Its own gutter was em-based and followed that step; ours
// is in pixels, so it has to follow deliberately or it ends up too tight on
// wide panes and wastefully loose on narrow ones.
const LABEL_FONT_STEP_PANE_WIDTH = 800;

// Widest rendered label at each of those font sizes ('10 AM'), measured in
// desktop Chrome. iOS renders the same font wider, hence the allowance.
//
// It is kept small on purpose. Because the label is right-aligned, unused
// allowance shows up as dead space between the divider and the text — the very
// thing the gutter is trying not to waste. A label that does run wider than
// expected spills left into the pane padding rather than being clipped (the
// only clipping ancestor is the pane itself), so the real tolerance is this
// allowance plus the padding, and overshooting costs nothing until both are
// used up.
const LABEL_TEXT_WIDTH_SMALL = 29;
const LABEL_TEXT_WIDTH_LARGE = 35;
const LABEL_FONT_ALLOWANCE = 1.1;

/**
 * Inset around the calendar pane's contents.
 *
 * Scaled so a narrow pane spends almost nothing on it — every pixel of width
 * matters on a phone — while a wide pane gets room to breathe.
 */
export const calendarPanePadding = (paneWidth: number) =>
  Math.round(Math.min(Math.max(paneWidth * 0.01, 2), 12));

/**
 * Gap between a time label and the grid it labels.
 *
 * Scaled to the pane rather than fixed: a few pixels is a large share of a
 * phone's gutter where width is scarce, and too tight on a wide pane, where
 * labels end up crowding the gridlines.
 */
export const timeLabelPadding = (paneWidth: number) =>
  Math.round(Math.min(Math.max(paneWidth * 0.012, 3), 10));

/**
 * Width of the time-label column. Feeds both the rendered gutter and the
 * scheduler-area maths, so the two cannot drift apart.
 */
export const timeGutterWidth = (paneWidth: number) => {
  const text =
    paneWidth >= LABEL_FONT_STEP_PANE_WIDTH
      ? LABEL_TEXT_WIDTH_LARGE
      : LABEL_TEXT_WIDTH_SMALL;
  return Math.round(text * LABEL_FONT_ALLOWANCE + timeLabelPadding(paneWidth));
};

/** Space left for day columns once the gutter and padding are removed. */
export const schedulerAreaWidth = (paneWidth: number) =>
  paneWidth - calendarPanePadding(paneWidth) * 2 - timeGutterWidth(paneWidth);

// Gutter and padding are both at their narrowest here, so this is the true
// floor for the pane.

export const getTimeGutterStyles = (paneWidth: number) => ({
  '--calendar-time-gutter-width': `${timeGutterWidth(paneWidth)}px`,
  '--calendar-time-label-padding': `${timeLabelPadding(paneWidth)}px`,
  '--calendar-pane-padding': `${calendarPanePadding(paneWidth)}px`,
});
