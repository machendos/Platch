import { useState } from 'react';
import { Temporal } from 'temporal-polyfill';

export const pageStartContaining = (
  anchor: Temporal.PlainDate,
  dayCount: number,
  date: Temporal.PlainDate,
) => {
  const pages = Math.floor(anchor.until(date).days / dayCount);
  return pages === 0 ? anchor : anchor.add({ days: pages * dayCount });
};

export const useCalendarPaging = (
  initialStart: Temporal.PlainDate,
  dayCount: number,
) => {
  const [pageStart, setPageStart] = useState(initialStart);
  const [todayRequest, setTodayRequest] = useState(0);

  const goToPage = (delta: number) =>
    setPageStart((start) => start.add({ days: delta * dayCount }));

  const goToToday = () => {
    setPageStart((start) =>
      pageStartContaining(start, dayCount, Temporal.Now.plainDateISO()),
    );
    setTodayRequest((requests) => requests + 1);
  };

  return { pageStart, todayRequest, goToPage, goToToday };
};
