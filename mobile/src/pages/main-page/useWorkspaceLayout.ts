import type { RefObject } from 'react';
import { useRef } from 'react';
import { clamp } from '../../system/helpers/helpers';
import { DISPATCHER_MIN_PANE_WIDTH } from './layout-config';
import { CALENDAR_MIN_PANE_WIDTH } from './calendar/layoutConfig';
import type { PaneWeights } from './layoutStorage';

type PaneWidths = PaneWeights;

const DISPATCHER_SELECTOR = '.dispatcher';
const CALENDAR_SELECTOR = '.calendar';

const paneTrack = (weight: number, min: number) =>
  `minmax(${min}px, ${weight}fr)`;

const measurePaneWidths = (
  workspace: HTMLElement | null,
): PaneWidths | null => {
  const dispatcher = workspace?.querySelector(DISPATCHER_SELECTOR);
  const calendar = workspace?.querySelector(CALENDAR_SELECTOR);
  if (!dispatcher || !calendar) return null;

  return {
    dispatcher: dispatcher.getBoundingClientRect().width,
    calendar: calendar.getBoundingClientRect().width,
  };
};

// How wide each workspace column is, and the drag that changes it.
//
// `paneWeights` is a bare ratio to begin with and pixel widths once a drag has
// happened. Both are fine because these are only ever `fr` values and nothing
// but their ratio is used — but do not read either as a width.
export const useWorkspaceLayout = (
  workspaceRef: RefObject<HTMLElement | null>,
  panesVisibility: { isDispatcherVisible: boolean; isCalendarVisible: boolean },
  paneWeights: PaneWeights,
  onPaneWeightsChange: (weights: PaneWeights) => void,
) => {
  const widthsAtDragStart = useRef<PaneWidths | null>(null);

  const rememberWidths = () => {
    widthsAtDragStart.current = measurePaneWidths(workspaceRef.current);
  };

  const resizePanes = (delta: number) => {
    const start = widthsAtDragStart.current;
    // Without this the clamp bounds invert — min above max — and the weights
    // come out negative. A negative `fr` makes the whole
    // `grid-template-columns` declaration invalid, so the browser drops it and
    // the workspace loses its layout entirely, not just one track.
    if (!start) return;

    // Negative when dragging left, positive when dragging right.
    const appliedDelta = clamp(
      delta,
      DISPATCHER_MIN_PANE_WIDTH - start.dispatcher,
      start.calendar - CALENDAR_MIN_PANE_WIDTH,
    );
    onPaneWeightsChange({
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
