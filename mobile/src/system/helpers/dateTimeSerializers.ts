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

const serializeDate = (date: { day: number; month?: string; year?: number }) =>
  `${date.month ?? ''} ${date.day}${date.year ? `, ${date.year}` : ''}`.trim();

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

  const serializedStart = serializeDate({
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

  const serializedEnd = serializeDate({
    day: endDay,
    month: endMonth,
    year: endYear,
  });

  return `${serializedStart}–${serializedEnd}`;
};
