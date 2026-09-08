/* What the page shell decides: how the two panes divide the workspace, and the
   one place every feature's CSS variables are gathered and applied.
 *
 * The features own their own numbers — see `calendar/layoutConfig.ts` and
 * `dispatcher/layoutConfig.ts`. Only values the workspace itself reasons about
 * belong here.
 */
import type { CSSProperties } from 'react';
import { CALENDAR_MIN_COLUMN_WIDTH } from './calendar/layoutConfig';
import { dispatcherCssVariables } from './dispatcher/layoutConfig';

export const DIVIDER_SIZE = 12;

export const DISPATCHER_MIN_PANE_WIDTH = 60;

// TODO: dynamic default pane weights
export const DEFAULT_PANE_WEIGHTS = { dispatcher: 1, calendar: 2 };

export const layoutCssVariables = {
  '--divider-size': `${DIVIDER_SIZE}px`,
  '--calendar-min-column-width': `${CALENDAR_MIN_COLUMN_WIDTH}px`,
  ...dispatcherCssVariables,
} as CSSProperties;
