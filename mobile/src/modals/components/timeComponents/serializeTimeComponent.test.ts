import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import { serializeTimeComponent } from './serializeTimeComponent';
import { newTimeComponentDraft } from './timeComponentsState';
import type { SlotDraft, TimeComponentDraft } from './timeComponentsState';

const TODAY = new Temporal.PlainDate(2026, 8, 11);
const ANCHOR = new Temporal.PlainDate(2026, 6, 19);

const date = (year: number, month: number, day: number) =>
  new Temporal.PlainDate(year, month, day);
const time = (hour: number, minute: number) =>
  new Temporal.PlainTime(hour, minute);

const draft = (over: Partial<TimeComponentDraft>): TimeComponentDraft => ({
  ...newTimeComponentDraft(ANCHOR),
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

describe('exact time components', () => {
  it('reads as one day with a collapsed time range', () => {
    const text = serializeTimeComponent(
      draft({
        type: 'ABSOLUTE',
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
    const text = serializeTimeComponent(
      draft({
        type: 'ABSOLUTE',
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
    const text = serializeTimeComponent(
      draft({
        type: 'ABSOLUTE',
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
    const text = serializeTimeComponent(
      draft({
        type: 'ABSOLUTE',
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
    const text = serializeTimeComponent(
      draft({ frequency: 'DAY', interval: 1, slots: [eveningSlot] }),
      TODAY,
    );

    expect(text).toBe('Daily · 5:45–6:45 PM');
  });

  it('names a single weekday in full', () => {
    const text = serializeTimeComponent(
      draft({ frequency: 'WEEK', interval: 1, byDay: ['TU'], slots: [eveningSlot] }),
      TODAY,
    );

    expect(text).toBe('Every Tuesday · 5:45–6:45 PM');
  });

  it('lists the days of a wider weekly interval', () => {
    const text = serializeTimeComponent(
      draft({
        frequency: 'WEEK',
        interval: 2,
        byDay: ['TH', 'TU'],
        slots: [eveningSlot],
      }),
      TODAY,
    );

    expect(text).toBe('Every 2 weeks on Tu, Th · 5:45–6:45 PM');
  });

  it('collapses all seven days into every day', () => {
    const text = serializeTimeComponent(
      draft({
        frequency: 'WEEK',
        interval: 1,
        byDay: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'],
        slots: [eveningSlot],
      }),
      TODAY,
    );

    expect(text).toBe('Every day · 5:45–6:45 PM');
  });

  it('speaks month days as ordinals and flexible slots as durations', () => {
    const text = serializeTimeComponent(
      draft({
        frequency: 'MONTH',
        interval: 1,
        byMonthDay: 30,
        slots: [slot({ flexibleMinutesNeeded: 120 })],
      }),
      TODAY,
    );

    expect(text).toBe('Monthly on the 30th · 2h flex');
  });

  it('names the month of a yearly cadence', () => {
    const text = serializeTimeComponent(
      draft({
        frequency: 'YEAR',
        interval: 1,
        byMonth: 1,
        byMonthDay: 30,
        slots: [eveningSlot],
      }),
      TODAY,
    );

    expect(text).toBe('Every Jan 30 · 5:45–6:45 PM');
  });

  it('joins several slots after one cadence', () => {
    const text = serializeTimeComponent(
      draft({
        frequency: 'DAY',
        interval: 1,
        slots: [
          slot({ from: time(7, 0), to: time(8, 0) }),
          slot({ key: 's2', flexibleMinutesNeeded: 120 }),
        ],
      }),
      TODAY,
    );

    expect(text).toBe('Daily · 7–8 AM, 2h flex');
  });

  it('falls back to the cadence alone while the slots are empty', () => {
    const text = serializeTimeComponent(draft({ slots: [slot({})] }), TODAY);

    expect(text).toBe('Every Friday');
  });
});
