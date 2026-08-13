import { useState } from 'react';
import { Temporal } from 'temporal-polyfill';
import type { DateRange } from '../../system/helpers/dateRange';

export const daysIn = ({ start, end }: DateRange) => start.until(end).days + 1;

export const shiftRange = (
  { start, end }: DateRange,
  days: number,
): DateRange => ({
  start: start.add({ days }),
  end: end.add({ days }),
});

/**
 * The range one whole page away from `range`, repeated until it covers `date`.
 *
 * Stepping by whole pages rather than recentring on `date` is what keeps the
 * pages on a fixed grid, so today's page is the same span whichever direction
 * it is reached from.
 */
export const pageContaining = (range: DateRange, date: Temporal.PlainDate) => {
  const length = daysIn(range);
  const pages = Math.floor(range.start.until(date).days / length);
  return pages === 0 ? range : shiftRange(range, pages * length);
};

/**
 * Moves the one interval the page is pointed at.
 *
 * The range itself lives in MainPage, alongside the rest of the stored layout;
 * this only works out where each control should move it to. The header's range
 * field and the calendar's columns are two views of that single value, so
 * paging, swiping and picking a range all move the same thing.
 *
 * How many days the calendar shows is the range's own length, so picking a
 * wider range in the header widens the calendar, and paging then steps by that
 * new width.
 */
export const useVisibleRange = (
  range: DateRange,
  onRangeChange: (range: DateRange) => void,
) => {
  // Ephemeral, so it stays here rather than with the stored range: it counts
  // presses so the calendar can scroll to today even when the page does not
  // move, and there is nothing worth restoring about it.
  const [todayRequest, setTodayRequest] = useState(0);

  const goToPage = (delta: number) =>
    onRangeChange(shiftRange(range, delta * daysIn(range)));

  const goToToday = () => {
    onRangeChange(pageContaining(range, Temporal.Now.plainDateISO()));
    setTodayRequest((requests) => requests + 1);
  };

  return { dayCount: daysIn(range), todayRequest, goToPage, goToToday };
};
