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

/* The colour band on a row's leading edge. A root project carries the broad
   one; anything nested carries a hairline, so depth reads at a glance without
   relying on the indent alone. */
export const PROJECT_STRIP_WIDTH = 8;
export const PROJECT_STRIP_WIDTH_NESTED = 2;

/* Smaller than the header's menu trigger: this one sits inside a row rather
   than being a control in its own right. PopoverMenu needs the number, not
   just the variable, because it offsets the panel by exactly this much. */
export const PROJECT_MENU_TRIGGER_SIZE = 28;

// TODO: dynamic default pane weights
export const DEFAULT_PANE_WEIGHTS = { dispatcher: 1, calendar: 2 };

export const layoutCssVariables = {
  '--section-header-height': `${DISPATCHER_SECTION_HEADER_HEIGHT}px`,
  '--divider-size': `${DIVIDER_SIZE}px`,
  '--calendar-min-column-width': `${CALENDAR_MIN_COLUMN_WIDTH}px`,
  '--project-row-min-height': `${PROJECT_ROW_MIN_HEIGHT}px`,
  '--project-row-gap': `${PROJECT_ROW_GAP}px`,
  '--project-indent-step': `${PROJECT_INDENT_STEP}px`,
  '--project-strip-width': `${PROJECT_STRIP_WIDTH}px`,
  '--project-strip-width-nested': `${PROJECT_STRIP_WIDTH_NESTED}px`,
} as CSSProperties;
