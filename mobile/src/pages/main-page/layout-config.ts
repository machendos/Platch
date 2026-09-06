import type { CSSProperties } from 'react';
import { CALENDAR_MIN_COLUMN_WIDTH } from './calendar/layoutConfig';

export const DISPATCHER_SECTION_HEADER_HEIGHT = 36;
export const DIVIDER_SIZE = 12;

export const DISPATCHER_MIN_PANE_WIDTH = 60;

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
  '--project-strip-width-inherited': `${PROJECT_STRIP_WIDTH_INHERITED}px`,
  '--project-consequence-line-height': `${PROJECT_CONSEQUENCE_LINE_HEIGHT}px`,
  '--project-consequence-dot-size': `${PROJECT_CONSEQUENCE_DOT_SIZE}px`,
  '--project-row-dragging-opacity': `${PROJECT_ROW_DRAGGING_OPACITY}`,
  '--project-drop-gap': `${PROJECT_DROP_GAP}px`,
  '--project-reveal-duration': `${PROJECT_REVEAL_DURATION_MS}ms`,
} as CSSProperties;
