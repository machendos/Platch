import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import {
  decodeDateFrame,
  encodeDateFrame,
} from '../../pages/main-page/layoutStorage';
import type { DateRange } from '../helpers/dateRange';

const date = (year: number, month: number, day: number) =>
  new Temporal.PlainDate(year, month, day);

describe('range deviceStorage', () => {
  it('stores a range of exactly today as an intent, not a date', () => {
    const today = Temporal.Now.plainDateISO();

    expect(encodeDateFrame([today, today])).toBe('TODAY');
  });

  it('resolves that intent against whatever today is on the way back', () => {
    const today = Temporal.Now.plainDateISO();

    expect(decodeDateFrame('TODAY')).toEqual([today, today]);
  });

  it('stores any other range as its two dates', () => {
    expect(
      encodeDateFrame([date(2026, 8, 1), date(2026, 8, 2)]),
    ).toEqual({ start: '2026-08-01', end: '2026-08-02' });
  });

  it('stores a single day that is not today as that date', () => {
    const notToday = Temporal.Now.plainDateISO().add({ days: 1 });

    expect(encodeDateFrame([notToday, notToday])).toEqual({
      start: notToday.toString(),
      end: notToday.toString(),
    });
  });

  it('stores a multi-day range starting today as dates', () => {
    const today = Temporal.Now.plainDateISO();
    const encoded = encodeDateFrame([today, today.add({ days: 1 })]);

    expect(encoded).not.toBe('TODAY');
  });

  it('round-trips a plain range', () => {
    const range: DateRange = [date(2026, 12, 30), date(2027, 1, 2)];

    expect(decodeDateFrame(encodeDateFrame(range))).toEqual(range);
  });
});
