import type { RefObject } from 'react';
import { useRef, useState } from 'react';
import { clamp } from '../../common/helpers';
import {
  DEFAULT_PANE_WEIGHTS,
  DISPATCHER_MIN_PANE_WIDTH,
} from './layout-config';
import { CALENDAR_MIN_PANE_WIDTH } from './calendar/layoutConfig';

type PaneWidths = { dispatcher: number; calendar: number };

// dispatcher | divider | calendar
const PANE_TRACK_COUNT = 3;

const paneTrack = (weight: number, min: number) =>
  `minmax(${min}px, ${weight}fr)`;

const resolvedPaneWidths = (
  workspace: HTMLElement | null,
): PaneWidths | null => {
  if (!workspace) return null;

  const tracks = getComputedStyle(workspace).gridTemplateColumns.split(' ');
  if (tracks.length !== PANE_TRACK_COUNT) return null;

  const dispatcher = parseFloat(tracks[0]);
  const calendar = parseFloat(tracks[PANE_TRACK_COUNT - 1]);
  if (!dispatcher || !calendar) return null;

  return { dispatcher, calendar };
};

// How wide each workspace column is, and the drag that changes it
export const useWorkspaceLayout = (
  workspaceRef: RefObject<HTMLElement | null>,
  panesVisibility: { isDispatcherVisible: boolean; isCalendarVisible: boolean },
) => {
  // A bare ratio to begin with, pixel widths once a drag has happened. Both
  // are fine because these are only ever `fr` values and nothing but their
  // ratio is used — but do not read either as a width.
  const [paneWeights, setPaneWeights] = useState(DEFAULT_PANE_WEIGHTS);

  const widthsAtDragStart = useRef<PaneWidths | null>(null);

  const rememberWidths = () => {
    widthsAtDragStart.current = resolvedPaneWidths(workspaceRef.current);
  };

  const resizePanes = (delta: number) => {
    const start = widthsAtDragStart.current;
    if (!start) return;

    // Negative when dragging left, positive when dragging right.
    const appliedDelta = clamp(
      delta,
      DISPATCHER_MIN_PANE_WIDTH - start.dispatcher,
      start.calendar - CALENDAR_MIN_PANE_WIDTH,
    );
    setPaneWeights({
      dispatcher: start.dispatcher + appliedDelta,
      calendar: start.calendar - appliedDelta,
    });
  };

  const gridTemplateColumns =
    panesVisibility.isDispatcherVisible && panesVisibility.isCalendarVisible
      ? [
          paneTrack(paneWeights.dispatcher, DISPATCHER_MIN_PANE_WIDTH),
          'auto',
          paneTrack(paneWeights.calendar, CALENDAR_MIN_PANE_WIDTH),
        ].join(' ')
      : '1fr';

  return { rememberWidths, resizePanes, gridTemplateColumns };
};
