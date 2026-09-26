import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import { spreadRecurringTimeComponent } from './spread.recurring.time.component';
import type { Project, RecurringTimeComponent, Slot } from '../../api/project';

const date = (year: number, month: number, day: number) =>
  new Temporal.PlainDate(year, month, day);

const time = (hour: number, minute = 0) => new Temporal.PlainTime(hour, minute);

const slot = (over: Partial<Slot> = {}): Slot => ({
  id: 's1',
  type: 'ABSOLUTE',
  recurringTimeComponentId: 'c1',
  from: time(9),
  to: time(10),
  flexibleMinutesNeeded: null,
  ...over,
});

const component = (
  over: Partial<RecurringTimeComponent> = {},
): RecurringTimeComponent => ({
  id: 'c1',
  projectId: 'p1',
  recurringInterval: 1,
  recurringFrequency: 'DAY',
  recurringByDay: [],
  recurringByMonthDay: null,
  recurringByMonth: null,
  firstRecurringEventAt: date(2026, 9, 1),
  lastRecurringEventAt: null,
  recurringTimeSlots: [slot()],
  ...over,
});

const projectIn = (
  projectType: 'INTERNAL' | 'EXTERNAL',
  originalTimezone: string,
): Project =>
  ({
    id: 'p1',
    name: 'Standup',
    projectType,
    originalTimezone,
    recurringTimeComponents: [],
  }) as unknown as Project;

const HERE = projectIn('INTERNAL', 'Europe/Kyiv');

const daysOf = (
  source: RecurringTimeComponent,
  from: Temporal.PlainDate,
  to: Temporal.PlainDate,
) =>
  spreadRecurringTimeComponent(source, HERE, [from, to], []).map((span) =>
    span.start.toPlainDate().toString(),
  );

describe('day cadence', () => {
  it('returns every day in the frame', () => {
    expect(daysOf(component(), date(2026, 9, 1), date(2026, 9, 4))).toEqual([
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
    ]);
  });

  it('counts the interval from the first date, not from the frame', () => {
    expect(
      daysOf(
        component({ recurringInterval: 3 }),
        date(2026, 9, 5),
        date(2026, 9, 14),
      ),
    ).toEqual(['2026-09-07', '2026-09-10', '2026-09-13']);
  });
});

describe('week cadence', () => {
  it('returns only the named weekdays', () => {
    expect(
      daysOf(
        component({
          recurringFrequency: 'WEEK',
          recurringByDay: ['MO', 'WE'],
        }),
        date(2026, 9, 1),
        date(2026, 9, 14),
      ),
    ).toEqual(['2026-09-02', '2026-09-07', '2026-09-09', '2026-09-14']);
  });

  it('skips the weeks the interval passes over', () => {
    expect(
      daysOf(
        component({
          recurringFrequency: 'WEEK',
          recurringInterval: 2,
          recurringByDay: ['MO'],
        }),
        date(2026, 9, 1),
        date(2026, 9, 30),
      ),
    ).toEqual(['2026-09-14', '2026-09-28']);
  });
});

describe('month cadence', () => {
  it('lands on the last day of a month too short for the anchor day', () => {
    expect(
      daysOf(
        component({
          recurringFrequency: 'MONTH',
          recurringByMonthDay: 31,
          firstRecurringEventAt: date(2026, 1, 31),
        }),
        date(2026, 1, 1),
        date(2026, 4, 30),
      ),
    ).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('does not drift once a short month has clamped it', () => {
    expect(
      daysOf(
        component({
          recurringFrequency: 'MONTH',
          recurringByMonthDay: 30,
          firstRecurringEventAt: date(2026, 1, 30),
        }),
        date(2026, 2, 1),
        date(2026, 3, 31),
      ),
    ).toEqual(['2026-02-28', '2026-03-30']);
  });
});

describe('year cadence', () => {
  it('clamps a leap day onto the last day of February', () => {
    expect(
      daysOf(
        component({
          recurringFrequency: 'YEAR',
          recurringByMonth: 2,
          recurringByMonthDay: 29,
          firstRecurringEventAt: date(2024, 2, 29),
        }),
        date(2024, 1, 1),
        date(2027, 12, 31),
      ),
    ).toEqual(['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28']);
  });
});

describe('bounds', () => {
  it('returns nothing before the first date', () => {
    expect(
      daysOf(component(), date(2026, 8, 20), date(2026, 9, 2)),
    ).toEqual(['2026-09-01', '2026-09-02']);
  });

  it('stops on the last date', () => {
    expect(
      daysOf(
        component({ lastRecurringEventAt: date(2026, 9, 3) }),
        date(2026, 9, 1),
        date(2026, 9, 10),
      ),
    ).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
  });
});

describe('slots', () => {
  it('gives one span per slot per occurrence', () => {
    const spans = spreadRecurringTimeComponent(
      component({
        recurringTimeSlots: [
          slot({ id: 'morning' }),
          slot({ id: 'evening', from: time(18), to: time(19) }),
        ],
      }),
      HERE,
      [date(2026, 9, 1), date(2026, 9, 2)],
      [],
    );

    expect(spans.map((span) => span.start.toString())).toEqual([
      '2026-09-01T09:00:00',
      '2026-09-01T18:00:00',
      '2026-09-02T09:00:00',
      '2026-09-02T18:00:00',
    ]);
  });

  it('ends an overnight slot on the following day', () => {
    const [span] = spreadRecurringTimeComponent(
      component({ recurringTimeSlots: [slot({ from: time(22), to: time(6) })] }),
      HERE,
      [date(2026, 9, 1), date(2026, 9, 1)],
      [],
    );

    expect(span.start.toString()).toBe('2026-09-01T22:00:00');
    expect(span.end.toString()).toBe('2026-09-02T06:00:00');
  });

  it('draws nothing for a slot with no clock time', () => {
    expect(
      spreadRecurringTimeComponent(
        component({
          recurringTimeSlots: [
            slot({
              type: 'FLEXIBLE',
              from: null,
              to: null,
              flexibleMinutesNeeded: 45,
            }),
          ],
        }),
        HERE,
        [date(2026, 9, 1), date(2026, 9, 3)],
        [],
      ),
    ).toEqual([]);
  });
});

describe('a project in a distant timezone', () => {
  const inLosAngeles = [
    {
      changesAt: Temporal.Instant.from('2020-01-01T00:00:00Z'),
      ianaTimezone: 'America/Los_Angeles',
    },
  ];

  const tokyoStandup = component({
    recurringTimeSlots: [slot({ from: time(8), to: time(9) })],
  });

  it('shows the occurrence whose project-local date falls outside the frame', () => {
    const shown = spreadRecurringTimeComponent(
      tokyoStandup,
      projectIn('EXTERNAL', 'Asia/Tokyo'),
      [date(2026, 9, 25), date(2026, 9, 25)],
      inLosAngeles,
    );

    expect(shown.map((event) => event.start.toString())).toEqual([
      '2026-09-25T16:00:00',
    ]);
  });

  it('leaves an internal project on its own wall clock', () => {
    const shown = spreadRecurringTimeComponent(
      tokyoStandup,
      projectIn('INTERNAL', 'Asia/Tokyo'),
      [date(2026, 9, 25), date(2026, 9, 25)],
      inLosAngeles,
    );

    expect(shown.map((event) => event.start.toString())).toEqual([
      '2026-09-25T08:00:00',
    ]);
  });
});
