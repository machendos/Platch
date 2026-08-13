import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import { daysIn, pageContaining, shiftRange } from './useVisibleRange';

const date = (year: number, month: number, day: number) =>
  new Temporal.PlainDate(year, month, day);

const shown = ({
  start,
  end,
}: {
  start: Temporal.PlainDate;
  end: Temporal.PlainDate;
}) => ({ start: start.toString(), end: end.toString() });

const twoDays = { start: date(2026, 8, 1), end: date(2026, 8, 2) };

describe('daysIn', () => {
  it('counts both ends', () => {
    expect(daysIn(twoDays)).toBe(2);
  });

  it('counts a single-day range as one', () => {
    const day = date(2026, 8, 11);
    expect(daysIn({ start: day, end: day })).toBe(1);
  });

  it('counts a range spanning a month boundary', () => {
    expect(daysIn({ start: date(2026, 8, 28), end: date(2026, 9, 3) })).toBe(7);
  });
});

describe('shiftRange', () => {
  it('moves both ends together', () => {
    expect(shown(shiftRange(twoDays, 2))).toEqual({
      start: '2026-08-03',
      end: '2026-08-04',
    });
  });

  it('moves backwards across a month boundary', () => {
    expect(shown(shiftRange(twoDays, -4))).toEqual({
      start: '2026-07-28',
      end: '2026-07-29',
    });
  });
});

describe('pageContaining', () => {
  it('stays put when the date is already in range', () => {
    expect(shown(pageContaining(twoDays, date(2026, 8, 2)))).toEqual(
      shown(twoDays),
    );
  });

  it('steps whole pages forward, staying on the grid', () => {
    expect(shown(pageContaining(twoDays, date(2026, 8, 8)))).toEqual({
      start: '2026-08-07',
      end: '2026-08-08',
    });
  });

  it('steps whole pages backward', () => {
    expect(shown(pageContaining(twoDays, date(2026, 7, 30)))).toEqual({
      start: '2026-07-30',
      end: '2026-07-31',
    });
  });

  it('lands on the same page from either direction', () => {
    const target = date(2026, 8, 8);
    const fromBehind = pageContaining(twoDays, target);
    const fromAhead = pageContaining(shiftRange(twoDays, 20), target);

    expect(shown(fromAhead)).toEqual(shown(fromBehind));
  });

  it('steps by the range length, not a fixed page', () => {
    const week = { start: date(2026, 8, 3), end: date(2026, 8, 15) };

    expect(shown(pageContaining(week, date(2026, 8, 20)))).toEqual({
      start: '2026-08-16',
      end: '2026-08-28',
    });
  });
});
