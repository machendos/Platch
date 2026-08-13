import { Temporal } from 'temporal-polyfill';
import type { DateRange } from '../../system/helpers/dateRange';
import { deviceStorage } from '../../system/device-storage/deviceStorage';

const KEYS = {
  panes: 'layout.panes',
  paneWeights: 'layout.pane-weights',
  // Not `layout.sections`: that key held the inverse, and reading one of those
  // back under the new meaning would open every section the user had closed.
  sectionsExpanded: 'layout.sections-expanded',
  sectionWeights: 'layout.section-weights',
  range: 'layout.range',
};

// Everything here gates MainPage's first render, so a read that never comes
// back would hold the page blank. Long enough that a cold start's first trip
// over the bridge is never cut short, short enough that a wedged read falls
// back to the defaults instead.
const READ_TIMEOUT_MS = 1000;

const TODAY = 'TODAY';

type StoredRange = typeof TODAY | { start: string; end: string };

export type PanesVisible = { dispatcher: boolean; calendar: boolean };
export type PaneWeights = { dispatcher: number; calendar: number };
/** True is shown: a section is expanded. */
export type SectionsExpanded = {
  plan: boolean;
  active: boolean;
  backlog: boolean;
};
export type SectionWeights = { plan: number; active: number; backlog: number };

export const encodeDateFrame = ({ start, end }: DateRange): StoredRange => {
  const today = Temporal.Now.plainDateISO();
  return start.equals(today) && end.equals(today)
    ? TODAY
    : { start: start.toString(), end: end.toString() };
};

export const decodeDateFrame = (stored: StoredRange): DateRange => {
  if (stored === TODAY) {
    const today = Temporal.Now.plainDateISO();
    return { start: today, end: today };
  }
  return {
    start: Temporal.PlainDate.from(stored.start),
    end: Temporal.PlainDate.from(stored.end),
  };
};

export const layoutStorage = {
  getPanes: () => deviceStorage.get<PanesVisible>(KEYS.panes, READ_TIMEOUT_MS),
  setPanes: (panes: PanesVisible) => deviceStorage.set(KEYS.panes, panes),

  getPaneWeights: () =>
    deviceStorage.get<PaneWeights>(KEYS.paneWeights, READ_TIMEOUT_MS),
  setPaneWeights: (weights: PaneWeights) =>
    deviceStorage.set(KEYS.paneWeights, weights),

  getSectionsExpanded: () =>
    deviceStorage.get<SectionsExpanded>(KEYS.sectionsExpanded, READ_TIMEOUT_MS),
  setSectionsExpanded: (sections: SectionsExpanded) =>
    deviceStorage.set(KEYS.sectionsExpanded, sections),

  getSectionWeights: () =>
    deviceStorage.get<SectionWeights>(KEYS.sectionWeights, READ_TIMEOUT_MS),
  setSectionWeights: (weights: SectionWeights) =>
    deviceStorage.set(KEYS.sectionWeights, weights),

  async getDateFrame(): Promise<DateRange | null> {
    const stored = await deviceStorage.get<StoredRange>(
      KEYS.range,
      READ_TIMEOUT_MS,
    );
    if (stored === null) return null;

    try {
      return decodeDateFrame(stored);
    } catch {
      return null;
    }
  },

  setDateFrame: (range: DateRange) => (
    console.log(encodeDateFrame(range)),
    deviceStorage.set(KEYS.range, encodeDateFrame(range))
  ),
};
