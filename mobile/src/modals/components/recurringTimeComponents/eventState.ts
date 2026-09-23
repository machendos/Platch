import { Temporal } from 'temporal-polyfill';
import type { Event } from '../../../api/event';
import type { EventToCreate } from '../../../api/project';
import {
  createDraftKey,
  getMinutesOfDay,
} from './recurringTimeComponentsState';

export type EventDraft = {
  key: string;
  id?: string;
  projectId?: string;
  kind: 'ABSOLUTE';
  fromDate: Temporal.PlainDate | null;
  fromTime: Temporal.PlainTime | null;
  toDate: Temporal.PlainDate | null;
  toTime: Temporal.PlainTime | null;
};

export const createEventDraft = (): EventDraft => ({
  key: createDraftKey(),
  kind: 'ABSOLUTE',
  fromDate: null,
  fromTime: null,
  toDate: null,
  toTime: null,
});

const addMinutesWithinDay = (
  time: Temporal.PlainTime,
  minutes: number,
): Temporal.PlainTime => {
  const later = time.add({ minutes });

  return Temporal.PlainTime.compare(later, time) > 0
    ? later
    : new Temporal.PlainTime(23, 55);
};

export const changeEventStart = (
  draft: EventDraft,
  fromDate: Temporal.PlainDate | null,
  fromTime: Temporal.PlainTime | null,
): EventDraft => {
  const moved = { ...draft, fromDate, fromTime };

  if (fromDate && fromTime) {
    const start = fromDate.toPlainDateTime(fromTime);
    const gap =
      draft.fromDate && draft.fromTime && draft.toDate && draft.toTime
        ? draft.fromDate
            .toPlainDateTime(draft.fromTime)
            .until(draft.toDate.toPlainDateTime(draft.toTime))
            .total({ unit: 'minutes' })
        : 0;
    const end = start.add({ minutes: gap > 0 ? gap : 60 });

    return { ...moved, toDate: end.toPlainDate(), toTime: end.toPlainTime() };
  }

  if (fromDate) {
    const dayGap =
      draft.fromDate && draft.toDate
        ? draft.fromDate.until(draft.toDate).total({ unit: 'days' })
        : 0;

    return { ...moved, toDate: fromDate.add({ days: Math.max(dayGap, 0) }) };
  }

  if (fromTime) {
    const gap =
      draft.fromTime &&
      draft.toTime &&
      Temporal.PlainTime.compare(draft.toTime, draft.fromTime) > 0
        ? getMinutesOfDay(draft.toTime) - getMinutesOfDay(draft.fromTime)
        : 60;

    return { ...moved, toTime: addMinutesWithinDay(fromTime, gap) };
  }

  return moved;
};

export const isEventDraftValid = (draft: EventDraft): boolean =>
  draft.fromDate !== null &&
  draft.fromTime !== null &&
  draft.toDate !== null &&
  draft.toTime !== null &&
  Temporal.PlainDateTime.compare(
    draft.fromDate.toPlainDateTime(draft.fromTime),
    draft.toDate.toPlainDateTime(draft.toTime),
  ) < 0;

export const toEventDraft = (event: Event): EventDraft => ({
  key: event.id,
  id: event.id,
  projectId: event.projectId,
  kind: 'ABSOLUTE',
  fromDate: event.start?.toPlainDate() ?? null,
  fromTime: event.start?.toPlainTime() ?? null,
  toDate: event.end?.toPlainDate() ?? null,
  toTime: event.end?.toPlainTime() ?? null,
});

export const toEvent = (draft: EventDraft): EventToCreate => ({
  start:
    draft.fromDate && draft.fromTime
      ? draft.fromDate.toPlainDateTime(draft.fromTime)
      : null,
  end:
    draft.toDate && draft.toTime
      ? draft.toDate.toPlainDateTime(draft.toTime)
      : null,
});
