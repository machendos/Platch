import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import { serializeRange } from './dateTimeSerializers';

const date = (year: number, month: number, day: number) =>
  new Temporal.PlainDate(year, month, day);

const TODAY = date(2026, 8, 11);

describe('serializeRange', () => {
  it('drops the end month inside one month', () => {
    expect(serializeRange(date(2026, 8, 1), date(2026, 8, 5), TODAY)).toBe(
      'Aug 1–5',
    );
  });

  it('keeps the end month across months', () => {
    expect(serializeRange(date(2026, 8, 28), date(2026, 9, 3), TODAY)).toBe(
      'Aug 28–Sep 3',
    );
  });

  it('gives the start a year only when it is not the current one', () => {
    expect(serializeRange(date(2025, 8, 1), date(2025, 8, 5), TODAY)).toBe(
      'Aug 1, 2025–5',
    );
  });

  it('gives the end a year when the range crosses one', () => {
    expect(serializeRange(date(2025, 12, 30), date(2026, 1, 2), TODAY)).toBe(
      'Dec 30, 2025–Jan 2, 2026',
    );
  });

  it('keeps the end month when a year is shown, matching months or not', () => {
    expect(serializeRange(date(2027, 8, 1), date(2028, 8, 5), TODAY)).toBe(
      'Aug 1, 2027–Aug 5, 2028',
    );
  });

  it('collapses a single-day range to the one date', () => {
    expect(serializeRange(date(2026, 8, 11), date(2026, 8, 11), TODAY)).toBe(
      'Aug 11',
    );
  });

  it('leaves no space before the year comma', () => {
    expect(serializeRange(date(2025, 3, 4), date(2025, 3, 4), TODAY)).toBe(
      'Mar 4, 2025',
    );
  });
});
