import './Calendar.css';

import '@mobiscroll/react/dist/css/mobiscroll.min.css';
import { Eventcalendar } from '@mobiscroll/react';
import { useCalendarZoom } from './useCalendarZoom';
import { usePaneWidth } from './usePaneWidth';
import { splitDaysIntoRows } from './calendarLayout';
import { useRef, useState } from 'react';
import { MbscEventcalendarView } from '@mobiscroll/react/dist/src/core/components/eventcalendar/eventcalendar.types.public';
import { Temporal } from 'temporal-polyfill';
import { testEvents } from './test.data';
import { toJsDate } from '../../../common/helpers';
import { getTimeGutterStyles } from './time-gutter-sizes';

// Day type is default type and week type is a type used in case of one day view
// to bypass mobiscroll behavior of rendering entire week in the header
const getSchedulerViewOption = (
  days: number,
  dayOfWeek: number,
  [startTime, endTime]: [string, string],
): MbscEventcalendarView => ({
  scheduler: {
    ...(days === 1
      ? { type: 'week' as const, startDay: dayOfWeek, endDay: dayOfWeek }
      : { type: 'day' as const, size: days }),
    allDay: false,
    startTime,
    endTime,
    timeCellStep: 60,
    timeLabelStep: 60,

    virtualScroll: false,
  },
});

type CalendarProps = { isDarkModeEnabled: boolean };

export const Calendar = ({ isDarkModeEnabled }: CalendarProps) => {
  const [[rangeStart, rangeEnd]] = useState<
    [Temporal.PlainDate, Temporal.PlainDate]
  >([new Temporal.PlainDate(2026, 8, 1), new Temporal.PlainDate(2026, 8, 21)]);

  const [timeFrame] = useState<[string, string]>(['10:00:00', '22:00:00']);

  const dayCount = rangeStart.until(rangeEnd).days + 1;

  const containerRef = useRef<HTMLDivElement>(null);
  const { columnsPerRow, paneWidth } = usePaneWidth(containerRef);

  const rows = splitDaysIntoRows(dayCount, columnsPerRow, dayCount % 7 === 0);

  // The zoom-out limit depends on how much of the stack scales, which changes
  // with the number of rows as well as with the visible hours.
  const { cellHeight } = useCalendarZoom(
    containerRef,
    `${rows.length}:${timeFrame.join('-')}`,
  );

  let dayOffset = 0;
  const rowRanges = rows.map((days) => {
    const start = rangeStart.add({ days: dayOffset });
    dayOffset += days;
    return { start, days };
  });

  return (
    <div
      className={isDarkModeEnabled ? 'calendar calendar-dark' : 'calendar'}
      ref={containerRef}
      style={
        {
          '--calendar-cell-height': `${cellHeight}px`,
          ...getTimeGutterStyles(paneWidth),
        } as React.CSSProperties
      }
    >
      {rowRanges.map(({ start, days }, rowIndex) => (
        <div className="calendar-week-row" key={rowIndex}>
          <Eventcalendar
            themeVariant={isDarkModeEnabled ? 'dark' : 'light'}
            refDate={toJsDate(start)}
            selectedDate={toJsDate(start)}
            // Temporal counts Monday as 1; mobiscroll counts Sunday as 0.
            view={getSchedulerViewOption(days, start.dayOfWeek % 7, timeFrame)}
            data={testEvents}
          />
        </div>
      ))}
    </div>
  );
};
