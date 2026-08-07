import { describe, expect, it } from 'vitest';
import { daysPerRowThatFit, splitDaysIntoRows } from './calendarLayout';

const MIN_COLUMN = 80;

describe('daysPerRowThatFit', () => {
  it('fits as many whole columns as the width allows', () => {
    expect(daysPerRowThatFit(4 * MIN_COLUMN, MIN_COLUMN)).toBe(4);
    expect(daysPerRowThatFit(4 * MIN_COLUMN + 79, MIN_COLUMN)).toBe(4);
  });

  it('never drops below one column, however narrow', () => {
    expect(daysPerRowThatFit(10, MIN_COLUMN)).toBe(1);
    expect(daysPerRowThatFit(0, MIN_COLUMN)).toBe(1);
  });
});

describe('splitDaysIntoRows', () => {
  it('keeps everything on one row when it fits', () => {
    expect(splitDaysIntoRows(7, 9)).toEqual([7]);
    expect(splitDaysIntoRows(4, 4)).toEqual([4]);
  });

  it('splits evenly rather than leaving a lonely day', () => {
    // 10 days where 9 fit: balanced 5+5, not 9+1.
    expect(splitDaysIntoRows(10, 9)).toEqual([5, 5]);
  });

  it('gives each week its own row when a week fits', () => {
    expect(splitDaysIntoRows(14, 7, true)).toEqual([7, 7]);
  });

  it('splits each week separately so weeks never share a row', () => {
    // 4,3,4,3 keeps both weeks intact; 4,4,3,3 would straddle them.
    expect(splitDaysIntoRows(14, 4, true)).toEqual([4, 3, 4, 3]);
  });

  it('spreads a week evenly when only a few columns fit', () => {
    expect(splitDaysIntoRows(7, 3, true)).toEqual([3, 2, 2]);
  });

  it('ignores week alignment when the range is not week-aligned', () => {
    expect(splitDaysIntoRows(14, 4)).toEqual([4, 4, 3, 3]);
  });

  it('handles an empty range', () => {
    expect(splitDaysIntoRows(0, 7)).toEqual([]);
  });

  it('treats a column count below one as a single column', () => {
    expect(splitDaysIntoRows(3, 0)).toEqual([1, 1, 1]);
  });

  it('always accounts for every day exactly once', () => {
    for (const days of [1, 5, 7, 10, 14, 21, 30]) {
      for (const columns of [1, 2, 3, 4, 7, 10]) {
        const rows = splitDaysIntoRows(days, columns, days % 7 === 0);
        expect(rows.reduce((sum, n) => sum + n, 0)).toBe(days);
        expect(Math.max(...rows)).toBeLessThanOrEqual(
          Math.max(columns, 7), // week rows are allowed when a week fits
        );
      }
    }
  });
});
