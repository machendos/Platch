import { Temporal } from 'temporal-polyfill';
import {
  MONTH_NAMES,
  serializeClockTime,
  serializeDate,
  serializeDuration,
  serializeTimeRange,
  serializeWeekday,
} from '../../../system/helpers/dateTimeSerializers';
import { sortWeekdays } from './timeComponentsState';
import type {
  SlotDraft,
  TimeComponentDraft,
  Weekday,
} from './timeComponentsState';

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
  byMonth: number | null,
  byMonthDay: number | null,
) =>
  byMonth === null
    ? null
    : joinPresent(
        [MONTH_NAMES[byMonth - 1], byMonthDay === null ? null : String(byMonthDay)],
        ' ',
      );

const serializeCadence = (draft: TimeComponentDraft): string => {
  const { interval } = draft;

  if (draft.frequency === 'DAY') {
    return interval === 1 ? 'Daily' : `Every ${interval} days`;
  }

  if (draft.frequency === 'WEEK') {
    const days = sortWeekdays(draft.byDay);
    const everyDay = days.length === 7;
    const listed = days.map((day) => WEEKDAY_SHORT[day]).join(', ');

    if (interval === 1) {
      if (everyDay) return 'Every day';
      if (days.length === 1) return `Every ${WEEKDAY_FULL[days[0]]}`;
      return days.length > 0 ? `Every ${listed}` : 'Every week';
    }
    if (everyDay) return `Every ${interval} weeks, every day`;
    return days.length > 0
      ? `Every ${interval} weeks on ${listed}`
      : `Every ${interval} weeks`;
  }

  if (draft.frequency === 'MONTH') {
    const day = draft.byMonthDay === null ? null : `on the ${ordinal(draft.byMonthDay)}`;
    return joinPresent(
      [interval === 1 ? 'Monthly' : `Every ${interval} months`, day],
      ' ',
    );
  }

  const dayInYear = serializeDayInYear(draft.byMonth, draft.byMonthDay);
  if (interval === 1) {
    return dayInYear ? `Every ${dayInYear}` : 'Every year';
  }
  return joinPresent(
    [`Every ${interval} years`, dayInYear && `on ${dayInYear}`],
    ' ',
  );
};

const serializeSlot = (slot: SlotDraft): string | null => {
  if (slot.flexibleMinutesNeeded !== null) {
    return `${serializeDuration(slot.flexibleMinutesNeeded)} flex`;
  }
  if (slot.from && slot.to) return serializeTimeRange(slot.from, slot.to);
  if (slot.from) return serializeClockTime(slot.from);
  return null;
};

const serializeAbsolute = (
  draft: TimeComponentDraft,
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

export const serializeTimeComponent = (
  draft: TimeComponentDraft,
  today: Temporal.PlainDate = Temporal.Now.plainDateISO(),
): string => {
  if (draft.type === 'ABSOLUTE') return serializeAbsolute(draft, today);

  const slots = draft.slots
    .map(serializeSlot)
    .filter((slot): slot is string => slot !== null);
  return joinPresent([serializeCadence(draft), slots.join(', ')], ' · ');
};
