import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import {
  parseDuration,
  parseTimeOfDay,
  serializeDate,
  serializeDuration,
  serializeRange,
  serializeTimeOfDay,
} from './dateTimeSerializers';

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

  it('states a year the two ends share once, after the range', () => {
    expect(serializeRange(date(2025, 8, 1), date(2025, 8, 5), TODAY)).toBe(
      'Aug 1–5, 2025',
    );
  });

  it('leaves the current year off the end that falls in it', () => {
    expect(serializeRange(date(2025, 12, 30), date(2026, 1, 2), TODAY)).toBe(
      'Dec 30, 2025–Jan 2',
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

describe('serializeDate', () => {
  it('leaves the current year off', () => {
    expect(serializeDate(date(2026, 6, 19), TODAY)).toBe('Jun 19');
  });

  it('states any other year', () => {
    expect(serializeDate(date(2025, 3, 4), TODAY)).toBe('Mar 4, 2025');
    expect(serializeDate(date(2028, 11, 30), TODAY)).toBe('Nov 30, 2028');
  });

  it('agrees with the range serializer on a single day', () => {
    for (const day of [date(2026, 6, 19), date(2025, 3, 4)]) {
      expect(serializeDate(day, TODAY)).toBe(serializeRange(day, day, TODAY));
    }
  });
});

describe('serializeDuration', () => {
  it('drops the half that is zero', () => {
    expect(serializeDuration(45)).toBe('45m');
    expect(serializeDuration(120)).toBe('2h');
    expect(serializeDuration(0)).toBe('0m');
  });

  it('states both when both are present', () => {
    expect(serializeDuration(210)).toBe('3h 30m');
    expect(serializeDuration(30000)).toBe('500h');
  });
});

describe('parseDuration', () => {
  it('reads what the field prints', () => {
    for (const minutes of [1, 45, 120, 210, 30000]) {
      expect(parseDuration(serializeDuration(minutes))).toBe(minutes);
    }
  });

  it('accepts the shapes someone would actually type', () => {
    expect(parseDuration('3h30m')).toBe(210);
    expect(parseDuration('  3H 30M ')).toBe(210);
    expect(parseDuration('3:30')).toBe(210);
    expect(parseDuration('90')).toBe(90);
    expect(parseDuration('2h')).toBe(120);
    expect(parseDuration('45min')).toBe(45);
  });

  it('refuses what it cannot read rather than guessing', () => {
    for (const text of ['', '   ', 'soon', 'h', '3h m', '3x30']) {
      expect(parseDuration(text)).toBeNull();
    }
  });
});

describe('parseTimeOfDay', () => {
  it('reads what the field prints', () => {
    for (const [hour, minute] of [
      [0, 0],
      [9, 5],
      [12, 30],
      [17, 45],
      [23, 55],
    ]) {
      const time = new Temporal.PlainTime(hour, minute);
      expect(parseTimeOfDay(serializeTimeOfDay(time))?.toString()).toBe(
        time.toString(),
      );
    }
  });

  it('takes 24-hour and 12-hour forms', () => {
    expect(parseTimeOfDay('17:45')?.toString()).toBe('17:45:00');
    expect(parseTimeOfDay('5:45pm')?.toString()).toBe('17:45:00');
    expect(parseTimeOfDay('5:45 PM')?.toString()).toBe('17:45:00');
    expect(parseTimeOfDay('12:00 am')?.toString()).toBe('00:00:00');
    expect(parseTimeOfDay('12:00 pm')?.toString()).toBe('12:00:00');
    expect(parseTimeOfDay('9')?.toString()).toBe('09:00:00');
  });

  it('refuses impossible clock readings', () => {
    for (const text of ['25:00', '10:75', '13:00 pm', '0:30 am', 'noon', '']) {
      expect(parseTimeOfDay(text)).toBeNull();
    }
  });
});
