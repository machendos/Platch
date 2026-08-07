import type { CSSProperties } from 'react';

export const DISPATCHER_SECTION_HEADER_HEIGHT = 36;
export const DIVIDER_SIZE = 12;

export const CALENDAR_MIN_COLUMN_WIDTH = 80;
export const CALENDAR_TIME_GUTTER_WIDTH = 55;
export const CALENDAR_PANE_PADDING = 8;

export const CALENDAR_MIN_PANE_WIDTH =
  CALENDAR_TIME_GUTTER_WIDTH +
  CALENDAR_MIN_COLUMN_WIDTH +
  CALENDAR_PANE_PADDING * 2;

export const DISPATCHER_MIN_PANE_WIDTH = 60;

// How far past a wrap boundary the pane must travel before the number of
// columns changes. Without it, holding the divider exactly on a boundary
// makes the layout flip back and forth on every pixel of movement.
export const WRAP_HYSTERESIS = 16;

export const layoutCssVariables = {
  '--section-header-height': `${DISPATCHER_SECTION_HEADER_HEIGHT}px`,
  '--divider-size': `${DIVIDER_SIZE}px`,
  '--calendar-min-column-width': `${CALENDAR_MIN_COLUMN_WIDTH}px`,
  '--calendar-time-gutter-width': `${CALENDAR_TIME_GUTTER_WIDTH}px`,
  '--calendar-pane-padding': `${CALENDAR_PANE_PADDING}px`,
} as CSSProperties;
