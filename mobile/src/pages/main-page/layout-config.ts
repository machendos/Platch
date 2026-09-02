import type { CSSProperties } from 'react';
import { CALENDAR_MIN_COLUMN_WIDTH } from './calendar/layoutConfig';

export const DISPATCHER_SECTION_HEADER_HEIGHT = 36;
export const DIVIDER_SIZE = 12;

export const DISPATCHER_MIN_PANE_WIDTH = 60;

/* One project row carries a name line plus a second line held empty for what
   the concept puts there later (schedule, duration, cadence), so the height is
   two lines and not one. */
export const PROJECT_ROW_MIN_HEIGHT = 48;
export const PROJECT_ROW_GAP = 6;

/* Every row on the page steps by the same amount, whatever its depth. This is
   the fixed stand-in; it becomes a width-aware value derived from the deepest
   visible row once the dispatcher is a container query. */
export const PROJECT_INDENT_STEP = 16;

// TODO: dynamic default pane weights
export const DEFAULT_PANE_WEIGHTS = { dispatcher: 1, calendar: 2 };

export const layoutCssVariables = {
  '--section-header-height': `${DISPATCHER_SECTION_HEADER_HEIGHT}px`,
  '--divider-size': `${DIVIDER_SIZE}px`,
  '--calendar-min-column-width': `${CALENDAR_MIN_COLUMN_WIDTH}px`,
  '--project-row-min-height': `${PROJECT_ROW_MIN_HEIGHT}px`,
  '--project-row-gap': `${PROJECT_ROW_GAP}px`,
  '--project-indent-step': `${PROJECT_INDENT_STEP}px`,
} as CSSProperties;
