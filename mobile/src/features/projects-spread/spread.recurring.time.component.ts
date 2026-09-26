import { Temporal } from 'temporal-polyfill';
import type { Project, RecurringTimeComponent } from '../../api/project';
import {
  overlapsDateFrame,
  resolveInViewerZone,
} from './resolve.in.viewer.zone';
import type {
  SpreadEvent,
  TimeSpan,
  TimezoneChange,
} from './resolve.in.viewer.zone';

const FRAME_MARGIN_DAYS_BEFORE = 3;
const FRAME_MARGIN_DAYS_AFTER = 2;

type Weekday = RecurringTimeComponent['recurringByDay'][number];

const WEEKDAY_NUMBER: Record<Weekday, number> = {
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
  SU: 7,
};

const startOfWeek = (date: Temporal.PlainDate) =>
  date.subtract({ days: date.dayOfWeek - 1 });

const clampToMonth = (year: number, month: number, day: number) => {
  const { daysInMonth } = Temporal.PlainYearMonth.from({ year, month });

  return new Temporal.PlainDate(year, month, Math.min(day, daysInMonth));
};

const getOccurrenceDates = (
  component: RecurringTimeComponent,
  [frameStart, frameEnd]: [Temporal.PlainDate, Temporal.PlainDate],
): Temporal.PlainDate[] => {
  const first = component.firstRecurringEventAt;
  const last = component.lastRecurringEventAt;
  const generateFrom =
    Temporal.PlainDate.compare(first, frameStart) > 0 ? first : frameStart;
  const generateTo =
    last !== null && Temporal.PlainDate.compare(last, frameEnd) < 0
      ? last
      : frameEnd;

  if (Temporal.PlainDate.compare(generateFrom, generateTo) > 0) return [];

  const interval = Math.max(component.recurringInterval, 1);
  const dates: Temporal.PlainDate[] = [];

  const isShown = (date: Temporal.PlainDate) =>
    Temporal.PlainDate.compare(date, first) >= 0 &&
    Temporal.PlainDate.compare(date, generateFrom) >= 0 &&
    Temporal.PlainDate.compare(date, generateTo) <= 0;

  const skippedSteps = (elapsed: number) =>
    Math.max(0, Math.floor(elapsed / interval));

  if (component.recurringFrequency === 'DAY') {
    const start = skippedSteps(
      first.until(generateFrom).total({ unit: 'days' }),
    );

    for (let step = start; ; step += 1) {
      const date = first.add({ days: step * interval });
      if (Temporal.PlainDate.compare(date, generateTo) > 0) break;
      if (isShown(date)) dates.push(date);
    }

    return dates;
  }

  if (component.recurringFrequency === 'WEEK') {
    const firstWeek = startOfWeek(first);
    const start = skippedSteps(
      firstWeek.until(startOfWeek(generateFrom)).total({ unit: 'days' }) / 7,
    );

    for (let step = start; ; step += 1) {
      const weekStart = firstWeek.add({ weeks: step * interval });
      if (Temporal.PlainDate.compare(weekStart, generateTo) > 0) break;

      for (const weekday of component.recurringByDay) {
        const date = weekStart.add({ days: WEEKDAY_NUMBER[weekday] - 1 });
        if (isShown(date)) dates.push(date);
      }
    }

    return dates;
  }

  const monthDay = component.recurringByMonthDay ?? first.day;

  if (component.recurringFrequency === 'MONTH') {
    const firstMonth = Temporal.PlainYearMonth.from(first);
    const start = skippedSteps(
      (generateFrom.year - firstMonth.year) * 12 +
        (generateFrom.month - firstMonth.month),
    );

    for (let step = start; ; step += 1) {
      const month = firstMonth.add({ months: step * interval });
      if (
        Temporal.PlainDate.compare(month.toPlainDate({ day: 1 }), generateTo) >
        0
      )
        break;

      const date = clampToMonth(month.year, month.month, monthDay);
      if (isShown(date)) dates.push(date);
    }

    return dates;
  }

  const month = component.recurringByMonth ?? first.month;
  const start = skippedSteps(generateFrom.year - first.year);

  for (let step = start; ; step += 1) {
    const year = first.year + step * interval;
    if (year > generateTo.year) break;

    const date = clampToMonth(year, month, monthDay);
    if (isShown(date)) dates.push(date);
  }

  return dates;
};

const toSpans = (
  component: RecurringTimeComponent,
  date: Temporal.PlainDate,
): TimeSpan[] =>
  component.recurringTimeSlots.flatMap((slot) => {
    if (slot.from === null || slot.to === null) return [];

    const endsNextDay = Temporal.PlainTime.compare(slot.to, slot.from) <= 0;

    return [
      {
        start: date.toPlainDateTime(slot.from),
        end: (endsNextDay ? date.add({ days: 1 }) : date).toPlainDateTime(
          slot.to,
        ),
      },
    ];
  });

export const spreadRecurringTimeComponent = (
  component: RecurringTimeComponent,
  project: Project,
  dateFrame: [Temporal.PlainDate, Temporal.PlainDate],
  timezoneChanges: TimezoneChange[],
): SpreadEvent[] => {
  const widerFrame: [Temporal.PlainDate, Temporal.PlainDate] = [
    dateFrame[0].subtract({ days: FRAME_MARGIN_DAYS_BEFORE }),
    dateFrame[1].add({ days: FRAME_MARGIN_DAYS_AFTER }),
  ];

  return getOccurrenceDates(component, widerFrame)
    .flatMap((date) => toSpans(component, date))
    .map((span) => resolveInViewerZone(project, span, timezoneChanges))
    .filter((event) => overlapsDateFrame(event, dateFrame));
};
