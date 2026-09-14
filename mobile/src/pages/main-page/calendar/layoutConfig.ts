import type { CSSProperties } from 'react';
import type { Temporal } from 'temporal-polyfill';
import { clamp } from '../../../system/helpers/helpers';
import {
  serializeTimezoneOffset,
  serializeWeekday,
} from '../../../system/helpers/dateTimeSerializers';

export const CALENDAR_MIN_COLUMN_WIDTH = 80;

// Hour label and cell step
// Had to be implemented on our own, otherwise we would get calendar grid
// rebuild on cell resizing. Besides, properties change
// (timeCellStep,timeLabelStep) can only happen the gesture *ends* —
// which on a touch device is after the finger lifts
// Variables will be picked up directly by css and used in clamp func
export const DEFAULT_CELL_STEP_MINUTES = 60;
export const DEFAULT_LABEL_STEP_MINUTES = 60;
const LABEL_LINE_HEIGHT = 16;

// Cell heights at which detail switches on, both as hard steps: the line and
// the labels are either drawn or not, never part-drawn. Tune each freely — the
// two are independent, and nothing else reads them.
const SPARSE_LABELS_AT = 20;
const HALF_HOUR_LINE_AT = 56;
export const ABSOLUTE_MIN_CELL_HEIGHT = LABEL_LINE_HEIGHT / 2;

export const zoomDetailStyles = {
  '--calendar-sparse-labels-at': SPARSE_LABELS_AT,
  '--calendar-half-hour-at': HALF_HOUR_LINE_AT,
} as CSSProperties;

// Time gutter
// Mobiscroll steps its label font from 10px to 12px once the pane reaches
// roughly this width. Its own gutter was em-based and followed that step; ours
// is in pixels, so it has to follow deliberately, or it ends up too tight on
// wide panes and wastefully loose on narrow ones. All numbers are measured on
// multiple devices and the main purpose is to find a balances between wasting
// place on narrow phones and stacking everything too tight on a wide pane
const LABEL_FONT_STEP_PANE_WIDTH = 800;
const LABEL_TEXT_WIDTH_SMALL = 29;
const LABEL_TEXT_WIDTH_LARGE = 35;
const LABEL_FONT_ALLOWANCE = 1.1;

export const calendarPanePadding = (paneWidth: number) =>
  Math.round(clamp(paneWidth * 0.01, 2, 12));

// Gap between a time label and the grid it labels
const timeLabelPadding = (paneWidth: number) =>
  Math.round(clamp(paneWidth * 0.012, 3, 10));

export const timeGutterWidth = (paneWidth: number) => {
  const text =
    paneWidth >= LABEL_FONT_STEP_PANE_WIDTH
      ? LABEL_TEXT_WIDTH_LARGE
      : LABEL_TEXT_WIDTH_SMALL;
  return Math.round(text * LABEL_FONT_ALLOWANCE + timeLabelPadding(paneWidth));
};

export const schedulerAreaWidth = (paneWidth: number) =>
  paneWidth - calendarPanePadding(paneWidth) * 2 - timeGutterWidth(paneWidth);

export const getTimeGutterStyles = (paneWidth: number) => ({
  '--calendar-time-gutter-width': `${timeGutterWidth(paneWidth)}px`,
  '--calendar-time-label-padding': `${timeLabelPadding(paneWidth)}px`,
  '--calendar-pane-padding': `${calendarPanePadding(paneWidth)}px`,
});

// Day header
// A row's headers are all one size, chosen so the widest label in that row
// fits its column. Rows therefore only differ when one of them actually
// carries a timezone offset long enough to need the room, which makes the
// difference mean something rather than look arbitrary.
//
// The width is *estimated* from the character count rather than measured.
// Measuring means render-read-resize, and mobiscroll settles asynchronously
// for up to ~1.5s while Ionic can report zero during the first render — see
// docs/calendar-layout.md. An estimate is deterministic and testable, and is
// deliberately generous so it errs toward shrinking a little early rather
// than overflowing.
// Larger than mobiscroll's own 16px date, deliberately. Its date sat on its
// own line under the weekday, which lent it weight this one-line layout does
// not have; matching it by the number alone reads noticeably smaller.
const DAY_HEADER_FONT_SIZE = 18;
const MIN_DAY_HEADER_FONT_SIZE = 10;
// Average character advance as a fraction of the font size.
const DAY_HEADER_CHAR_RATIO = 0.58;
// The offset marker rides as a superscript, so it costs less than its length.
// Reaches CSS as a custom property, so raising it enlarges the marker and
// charges it more room in the same move. The extra width bold costs sits
// inside the slack already in DAY_HEADER_CHAR_RATIO.
const DAY_HEADER_SUPERSCRIPT_SCALE = 0.7;
const DAY_HEADER_PADDING = 4;
// Today's date sits in a disc this many times the type size.
const DAY_HEADER_BADGE_SCALE = 1.7;

/* The header box is a fixed height, so it does not breathe as the type scales
   with the pane or as the badge comes and goes — the row a badge lands in was
   otherwise a pixel taller than its neighbours. Tall enough for the largest
   thing it can hold, which is the badge at full size. */
const DAY_HEADER_HEIGHT = Math.ceil(
  DAY_HEADER_FONT_SIZE * DAY_HEADER_BADGE_SCALE,
);

// What each day asks of its column, in characters. Beside the fitting maths
// rather than beside the markup, so the estimate and the thing it estimates
// cannot drift apart.
export const dayHeaderLabelChars = (date: Temporal.PlainDate) =>
  serializeWeekday(date).length + 1 + String(date.day).length;

export const dayHeaderOffsetChars = (offsetMinutes: number | undefined) =>
  offsetMinutes === undefined
    ? 0
    : (serializeTimezoneOffset(offsetMinutes)?.length ?? 0);

// Timezone strips
/* The label sizes itself to the strip it sits in — see Calendar.css. These
   are only the ends of that range: the ceiling so a strip covering a whole
   afternoon does not shout, the floor so a one-hour strip on a zoomed-out
   grid still says something rather than shrinking away. */
const TZ_BAND_FONT_MIN = 7;
const TZ_BAND_FONT_MAX = 16;

export const timezoneBandStyles = {
  '--calendar-tz-band-font-min': `${TZ_BAND_FONT_MIN}px`,
  '--calendar-tz-band-font-max': `${TZ_BAND_FONT_MAX}px`,
} as CSSProperties;

export const dayHeaderStyles = {
  '--calendar-day-header-superscript-scale': DAY_HEADER_SUPERSCRIPT_SCALE,
  '--calendar-day-badge-scale': DAY_HEADER_BADGE_SCALE,
  '--calendar-day-header-height': `${DAY_HEADER_HEIGHT}px`,
} as CSSProperties;

export const dayHeaderFontSize = (
  columnWidth: number,
  labelChars: number,
  offsetChars: number,
) => {
  const advancePerFontPx =
    (labelChars + offsetChars * DAY_HEADER_SUPERSCRIPT_SCALE) *
    DAY_HEADER_CHAR_RATIO;

  const available = columnWidth - DAY_HEADER_PADDING * 2;
  if (advancePerFontPx <= 0 || available <= 0) return DAY_HEADER_FONT_SIZE;

  return clamp(
    available / advancePerFontPx,
    MIN_DAY_HEADER_FONT_SIZE,
    DAY_HEADER_FONT_SIZE,
  );
};

// Page motions (swipes/slides)
// How far a finger must travel sideways before the page actually turns
// (fraction of the pane)
const SWIPE_FRACTION = 0.14;
const MIN_SWIPE_DISTANCE = 32;
const MAX_SWIPE_DISTANCE = 480;

export const swipeThreshold = (paneWidth: number) =>
  clamp(paneWidth * SWIPE_FRACTION, MIN_SWIPE_DISTANCE, MAX_SWIPE_DISTANCE);

// How far a finger travels before the gesture is committed to an axis.
// Deliberately small and not scaled – needed just to beat IOS
export const LOCK_DISTANCE = 8;

// How much more sideways than vertical a drag has to be to count as a swipe.
// Above 1 on purpose: scrolling is more common intent
export const LOCK_RATIO = 1.2;

// How far the new page starts from, and how long it takes to settle
export const SLIDE_DISTANCE = 48;
export const SLIDE_DURATION_MS = 260;

/**
 * When the Today scroll starts, measured from the *end* of the page slide.
 *
 * Positive delays it until after the slide has settled; negative pulls it
 * earlier, and anything at or below `-SLIDE_DURATION_MS` starts it at once.
 * That is the setting: waiting for the slide to finish made pressing Today
 * feel sluggish, and starting immediately is safe because the slide is a
 * `translateX` — it moves nothing this scroll measures, which is all vertical.
 */
export const TODAY_SCROLL_OFFSET_FROM_SLIDE_END_MS = -1000;

// While a finger is dragging, the columns follow it at 1/DAMPING speed.
export const DAMPING = 3;
export const MAX_NUDGE = SLIDE_DISTANCE;

// How far past a wrap boundary the pane must travel before the number of
// columns changes. Without it, holding the divider exactly on a boundary
// makes the layout flip back and forth on every pixel of movement.
export const WRAP_HYSTERESIS = 16;

export const CALENDAR_MIN_PANE_WIDTH =
  timeGutterWidth(0) + CALENDAR_MIN_COLUMN_WIDTH + calendarPanePadding(0) * 2;
