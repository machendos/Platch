import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import { serializeTimeEntry } from './serializeTimeEntry';
import { createRecurringTimeComponentDraft } from './recurringTimeComponentsState';
import type { RecurringTimeComponentDraft, SlotDraft } from './recurringTimeComponentsState';
import { createEventDraft } from './eventState';
import type { EventDraft } from './eventState';

const TODAY = new Temporal.PlainDate(2026, 8, 11);
const ANCHOR = new Temporal.PlainDate(2026, 6, 19);

const date = (year: number, month: number, day: number) =>
  new Temporal.PlainDate(year, month, day);
const time = (hour: number, minute: number) =>
  new Temporal.PlainTime(hour, minute);

const draft = (over: Partial<RecurringTimeComponentDraft> = {}): RecurringTimeComponentDraft => ({
  ...createRecurringTimeComponentDraft(ANCHOR),
  ...over,
});

const exact = (over: Partial<EventDraft> = {}): EventDraft => ({
  ...createEventDraft(),
  ...over,
});

const slot = (over: Partial<SlotDraft>): SlotDraft => ({
  key: 's',
  from: null,
  to: null,
  flexibleMinutesNeeded: null,
  ...over,
});

const eveningSlot = slot({ from: time(17, 45), to: time(18, 45) });

describe('exact entries', () => {
  it('reads as one day with a collapsed time range', () => {
    const text = serializeTimeEntry(
      exact({
        fromDate: date(2026, 6, 19),
        fromTime: time(17, 45),
        toDate: date(2026, 6, 19),
        toTime: time(18, 45),
      }),
      TODAY,
    );

    expect(text).toBe('Fri, Jun 19 · 5:45–6:45 PM');
  });

  it('names a year that is not the current one', () => {
    const text = serializeTimeEntry(
      exact({
        fromDate: date(2025, 6, 19),
        fromTime: time(17, 45),
        toDate: date(2025, 6, 19),
        toTime: time(18, 45),
      }),
      TODAY,
    );

    expect(text).toBe('Thu, Jun 19, 2025 · 5:45–6:45 PM');
  });

  it('drops the weekday from the end of a cross-day range', () => {
    const text = serializeTimeEntry(
      exact({
        fromDate: date(2026, 6, 19),
        fromTime: time(17, 45),
        toDate: date(2026, 6, 20),
        toTime: time(18, 45),
      }),
      TODAY,
    );

    expect(text).toBe('Fri, Jun 19 · 5:45 PM – Jun 20 · 6:45 PM');
  });

  it('keeps only the date while the times are missing', () => {
    const text = serializeTimeEntry(
      exact({
        fromDate: date(2026, 6, 19),
        fromTime: null,
        toDate: null,
        toTime: null,
      }),
      TODAY,
    );

    expect(text).toBe('Fri, Jun 19');
  });
});

describe('recurring cadences', () => {
  it('says Daily for every single day', () => {
    const text = serializeTimeEntry(
      draft({
        recurringFrequency: 'DAY',
        recurringInterval: 1,
        recurringTimeSlots: [eveningSlot],
      }),
      TODAY,
    );

    expect(text).toBe('Daily · 5:45–6:45 PM');
  });

  it('names a single weekday in full', () => {
    const text = serializeTimeEntry(
      draft({
        recurringFrequency: 'WEEK',
        recurringInterval: 1,
        recurringByDay: ['TU'],
        recurringTimeSlots: [eveningSlot],
      }),
      TODAY,
    );

    expect(text).toBe('Every Tuesday · 5:45–6:45 PM');
  });

  it('lists the days of a wider weekly recurringInterval', () => {
    const text = serializeTimeEntry(
      draft({
        recurringFrequency: 'WEEK',
        recurringInterval: 2,
        recurringByDay: ['TH', 'TU'],
        recurringTimeSlots: [eveningSlot],
      }),
      TODAY,
    );

    expect(text).toBe('Every 2 weeks on Tu, Th · 5:45–6:45 PM');
  });

  it('collapses all seven days into every day', () => {
    const text = serializeTimeEntry(
      draft({
        recurringFrequency: 'WEEK',
        recurringInterval: 1,
        recurringByDay: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'],
        recurringTimeSlots: [eveningSlot],
      }),
      TODAY,
    );

    expect(text).toBe('Every day · 5:45–6:45 PM');
  });

  it('speaks month days as ordinals and flexible recurringTimeSlots as durations', () => {
    const text = serializeTimeEntry(
      draft({
        recurringFrequency: 'MONTH',
        recurringInterval: 1,
        recurringByMonthDay: 30,
        recurringTimeSlots: [slot({ flexibleMinutesNeeded: 120 })],
      }),
      TODAY,
    );

    expect(text).toBe('Monthly on the 30th · 2h flex');
  });

  it('names the month of a yearly cadence', () => {
    const text = serializeTimeEntry(
      draft({
        recurringFrequency: 'YEAR',
        recurringInterval: 1,
        recurringByMonth: 1,
        recurringByMonthDay: 30,
        recurringTimeSlots: [eveningSlot],
      }),
      TODAY,
    );

    expect(text).toBe('Every Jan 30 · 5:45–6:45 PM');
  });

  it('marks an overnight slot with +1', () => {
    const text = serializeTimeEntry(
      draft({
        recurringFrequency: 'DAY',
        recurringInterval: 1,
        recurringTimeSlots: [slot({ from: time(22, 0), to: time(2, 0) })],
      }),
      TODAY,
    );

    expect(text).toBe('Daily · 10 PM–2 AM +1');
  });

  it('marks a full-day slot the same way', () => {
    const text = serializeTimeEntry(
      draft({
        recurringFrequency: 'DAY',
        recurringInterval: 1,
        recurringTimeSlots: [slot({ from: time(17, 45), to: time(17, 45) })],
      }),
      TODAY,
    );

    expect(text).toBe('Daily · 5:45–5:45 PM +1');
  });

  it('joins several recurringTimeSlots after one cadence', () => {
    const text = serializeTimeEntry(
      draft({
        recurringFrequency: 'DAY',
        recurringInterval: 1,
        recurringTimeSlots: [
          slot({ from: time(7, 0), to: time(8, 0) }),
          slot({ key: 's2', flexibleMinutesNeeded: 120 }),
        ],
      }),
      TODAY,
    );

    expect(text).toBe('Daily · 7–8 AM, 2h flex');
  });

  it('falls back to the cadence alone while the recurringTimeSlots are empty', () => {
    const text = serializeTimeEntry(
      draft({ recurringTimeSlots: [slot({})] }),
      TODAY,
    );

    expect(text).toBe('Every Friday');
  });

  it('says nothing about bounds the cadence already implies', () => {
    const text = serializeTimeEntry(
      draft({
        recurringTimeSlots: [slot({})],
        firstRecurringEventAt: date(2026, 6, 19),
        lastRecurringEventAt: null,
      }),
      TODAY,
    );

    expect(text).toBe('Every Friday');
  });

  it('states a first date still to come, and any end at all', () => {
    expect(
      serializeTimeEntry(
        draft({
          recurringTimeSlots: [slot({})],
          firstRecurringEventAt: date(2026, 9, 1),
        }),
        TODAY,
      ),
    ).toBe('Every Friday · from Sep 1');

    expect(
      serializeTimeEntry(
        draft({
          recurringTimeSlots: [slot({})],
          lastRecurringEventAt: date(2026, 12, 1),
        }),
        TODAY,
      ),
    ).toBe('Every Friday · until Dec 1');
  });
});
