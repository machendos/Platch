import { Temporal } from 'temporal-polyfill';
import {
  MONTH_NAMES,
  serializeClockTime,
  serializeDate,
  serializeDuration,
  serializeTimeRange,
  serializeWeekday,
} from '../../../system/helpers/dateTimeSerializers';
import {
  wrapsMidnight,
  sortWeekdays,
} from './recurringTimeComponentsState';
import type {
  RecurringTimeComponentDraft,
  SlotDraft,
  Weekday,
} from './recurringTimeComponentsState';
import type { EventDraft } from './eventState';
import type { TimeEntryDraft } from './timeEntriesState';

const WEEKDAY_SHORT: Record<Weekday, string> = {
  MO: 'Mo',
  TU: 'Tu',
  WE: 'We',
  TH: 'Th',
  FR: 'Fr',
  SA: 'Sa',
  SU: 'Su',
};

const WEEKDAY_FULL: Record<Weekday, string> = {
  MO: 'Monday',
  TU: 'Tuesday',
  WE: 'Wednesday',
  TH: 'Thursday',
  FR: 'Friday',
  SA: 'Saturday',
  SU: 'Sunday',
};

const ordinal = (day: number): string => {
  const tens = day % 100;
  const ones = day % 10;
  const suffix =
    tens >= 11 && tens <= 13
      ? 'th'
      : ones === 1
        ? 'st'
        : ones === 2
          ? 'nd'
          : ones === 3
            ? 'rd'
            : 'th';
  return `${day}${suffix}`;
};

const joinPresent = (parts: (string | null)[], separator: string) =>
  parts.filter((part) => part !== null && part !== '').join(separator);

const serializeDayInYear = (
  recurringByMonth: number | null,
  recurringByMonthDay: number | null,
) =>
  recurringByMonth === null
    ? null
    : joinPresent(
        [
          MONTH_NAMES[recurringByMonth - 1],
          recurringByMonthDay === null ? null : String(recurringByMonthDay),
        ],
        ' ',
      );

const serializeCadence = (draft: RecurringTimeComponentDraft): string => {
  const { recurringInterval } = draft;

  if (draft.recurringFrequency === 'DAY') {
    return recurringInterval === 1
      ? 'Daily'
      : `Every ${recurringInterval} days`;
  }

  if (draft.recurringFrequency === 'WEEK') {
    const days = sortWeekdays(draft.recurringByDay);
    const everyDay = days.length === 7;
    const listed = days.map((day) => WEEKDAY_SHORT[day]).join(', ');

    if (recurringInterval === 1) {
      if (everyDay) return 'Every day';
      if (days.length === 1) return `Every ${WEEKDAY_FULL[days[0]]}`;
      return days.length > 0 ? `Every ${listed}` : 'Every week';
    }
    if (everyDay) return `Every ${recurringInterval} weeks, every day`;
    return days.length > 0
      ? `Every ${recurringInterval} weeks on ${listed}`
      : `Every ${recurringInterval} weeks`;
  }

  if (draft.recurringFrequency === 'MONTH') {
    const day =
      draft.recurringByMonthDay === null
        ? null
        : `on the ${ordinal(draft.recurringByMonthDay)}`;
    return joinPresent(
      [
        recurringInterval === 1
          ? 'Monthly'
          : `Every ${recurringInterval} months`,
        day,
      ],
      ' ',
    );
  }

  const dayInYear = serializeDayInYear(
    draft.recurringByMonth,
    draft.recurringByMonthDay,
  );
  if (recurringInterval === 1) {
    return dayInYear ? `Every ${dayInYear}` : 'Every year';
  }
  return joinPresent(
    [`Every ${recurringInterval} years`, dayInYear && `on ${dayInYear}`],
    ' ',
  );
};

const serializeSlot = (slot: SlotDraft): string | null => {
  if (slot.flexibleMinutesNeeded !== null) {
    return `${serializeDuration(slot.flexibleMinutesNeeded)} flex`;
  }
  if (slot.from && slot.to) {
    const range = serializeTimeRange(slot.from, slot.to);
    return wrapsMidnight(slot) ? `${range} +1` : range;
  }
  if (slot.from) return serializeClockTime(slot.from);
  return null;
};

const serializeAbsolute = (
  draft: EventDraft,
  today: Temporal.PlainDate,
): string => {
  const startDate = draft.fromDate
    ? `${serializeWeekday(draft.fromDate)}, ${serializeDate(draft.fromDate, today)}`
    : null;
  const sameDay =
    draft.toDate === null ||
    (draft.fromDate !== null && draft.fromDate.equals(draft.toDate));

  if (sameDay) {
    const times =
      draft.fromTime && draft.toTime
        ? serializeTimeRange(draft.fromTime, draft.toTime)
        : draft.fromTime
          ? serializeClockTime(draft.fromTime)
          : null;
    return joinPresent([startDate, times], ' · ');
  }

  const start = joinPresent(
    [startDate, draft.fromTime && serializeClockTime(draft.fromTime)],
    ' · ',
  );
  const end = joinPresent(
    [
      draft.toDate && serializeDate(draft.toDate, today),
      draft.toTime && serializeClockTime(draft.toTime),
    ],
    ' · ',
  );
  return joinPresent([start, end], ' – ');
};

// Only what the cadence does not already imply: every component has a first
// date, so one that has already passed says nothing, while one still to come
// and any end at all are both real news.
const serializeBounds = (
  draft: RecurringTimeComponentDraft,
  today: Temporal.PlainDate,
): string =>
  joinPresent(
    [
      draft.firstRecurringEventAt &&
      Temporal.PlainDate.compare(draft.firstRecurringEventAt, today) > 0
        ? `from ${serializeDate(draft.firstRecurringEventAt, today)}`
        : null,
      draft.lastRecurringEventAt
        ? `until ${serializeDate(draft.lastRecurringEventAt, today)}`
        : null,
    ],
    ' ',
  );

export const serializeTimeEntry = (
  draft: TimeEntryDraft,
  today: Temporal.PlainDate = Temporal.Now.plainDateISO(),
): string => {
  if (draft.kind === 'ABSOLUTE') return serializeAbsolute(draft, today);

  const recurringTimeSlots = draft.recurringTimeSlots
    .map(serializeSlot)
    .filter((slot): slot is string => slot !== null);
  return joinPresent(
    [
      serializeCadence(draft),
      recurringTimeSlots.join(', '),
      serializeBounds(draft, today),
    ],
    ' · ',
  );
};
