import { Temporal } from 'temporal-polyfill';

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const serializeParts = (date: { day: number; month?: string; year?: number }) =>
  `${date.month ?? ''} ${date.day}${date.year ? `, ${date.year}` : ''}`.trim();

// The single-date case serializeRange was already computing privately, given a
// name of its own so a field showing one date reads the same way as one end of
// a range does.
export const serializeDate = (
  date: Temporal.PlainDate,
  today: Temporal.PlainDate = Temporal.Now.plainDateISO(),
): string =>
  serializeParts({
    day: date.day,
    month: MONTH_NAMES[date.month - 1],
    year: date.year === today.year ? undefined : date.year,
  });

export const serializeRange = (
  start: Temporal.PlainDate,
  end: Temporal.PlainDate,
  today: Temporal.PlainDate = Temporal.Now.plainDateISO(),
): string => {
  const startDay = start.day;
  const startMonth = MONTH_NAMES[start.month - 1];

  const startYear =
    start.year !== today.year && (start.year !== end.year || start.equals(end))
      ? start.year
      : undefined;

  const serializedStart = serializeParts({
    day: startDay,
    month: startMonth,
    year: startYear,
  });

  if (start.equals(end)) {
    return serializedStart;
  }

  const endDay = end.day;
  const endYear = end.year !== today.year ? end.year : undefined;
  const endMonth =
    end.month !== start.month || startYear
      ? MONTH_NAMES[end.month - 1]
      : undefined;

  const serializedEnd = serializeParts({
    day: endDay,
    month: endMonth,
    year: endYear,
  });

  return `${serializedStart}–${serializedEnd}`;
};

export const serializeDuration = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;

  return `${hours}h ${minutes}m`;
};

export const serializeTimeOfDay = (time: Temporal.PlainTime): string =>
  `${time.hour % 12 || 12}:${String(time.minute).padStart(2, '0')} ${
    time.hour < 12 ? 'AM' : 'PM'
  }`;

// Typed input is forgiving on purpose: someone correcting "3h 30m" by hand
// should not have to reproduce the format the field prints.
export const parseDuration = (text: string): number | null => {
  const input = text.trim().toLowerCase();
  if (!input) return null;

  const labelled = /^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m(?:in)?)?$/.exec(input);
  if (labelled && (labelled[1] || labelled[2])) {
    return Number(labelled[1] ?? 0) * 60 + Number(labelled[2] ?? 0);
  }

  const clock = /^(\d+)\s*[:.]\s*(\d{1,2})$/.exec(input);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);

  const bare = /^\d+$/.exec(input);
  if (bare) return Number(input);

  return null;
};

export const parseTimeOfDay = (text: string): Temporal.PlainTime | null => {
  const input = text.trim().toLowerCase();
  const match = /^(\d{1,2})\s*[:.\s]?\s*(\d{2})?\s*(am|pm)?$/.exec(input);
  if (!match) return null;

  const minute = Number(match[2] ?? 0);
  if (minute > 59) return null;

  let hour = Number(match[1]);
  const meridiem = match[3];

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (meridiem === 'pm' ? 12 : 0);
  } else if (hour > 23) {
    return null;
  }

  return new Temporal.PlainTime(hour, minute);
};
