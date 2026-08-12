import './Calendar.css';

import '@mobiscroll/react/dist/css/mobiscroll.min.css';
import { Eventcalendar } from '@mobiscroll/react';
import { useCalendarZoom } from './zoom/useCalendarZoom';
import { useCalendarSwipe } from './navigation/useCalendarSwipe';
import { useCalendarSlide } from './navigation/useCalendarSlide';
import { useCalendarRevealToday } from './navigation/useCalendarRevealToday';
import { usePaneWidth } from './usePaneWidth';
import { splitDaysIntoRows } from './calendarLayout';
import { useRef } from 'react';
import { MbscEventcalendarView } from '@mobiscroll/react/dist/src/core/components/eventcalendar/eventcalendar.types.public';
import type { MbscCalendarEvent } from '@mobiscroll/react/dist/src/core/shared/calendar-view/calendar-view.types.public';
import { Temporal } from 'temporal-polyfill';
import { toJsDate } from '../../../common/helpers';
import {
  DEFAULT_CELL_STEP_MINUTES,
  DEFAULT_LABEL_STEP_MINUTES,
  getTimeGutterStyles,
  zoomDetailStyles,
  SLIDE_DURATION_MS,
} from './layoutConfig';

const getSchedulerViewOption = (
  days: number,
  [startTime, endTime]: [string, string],
): MbscEventcalendarView => ({
  scheduler: {
    type: 'day',
    size: days,
    allDay: false,
    startTime,
    endTime,
    timeCellStep: DEFAULT_CELL_STEP_MINUTES,
    timeLabelStep: DEFAULT_LABEL_STEP_MINUTES,
    virtualScroll: false,
  },
});

type CalendarProps = {
  isDarkModeEnabled: boolean;
  pageStart: Temporal.PlainDate;
  dayCount: number;
  /** Hours the grid covers, as `HH:MM:SS` — the first and last shown. */
  timeFrame: [string, string];
  events: MbscCalendarEvent[];
  todayRequest: number;
  onPageChange: (delta: number) => void;
};

export const Calendar = ({
  isDarkModeEnabled,
  pageStart,
  dayCount,
  timeFrame,
  events,
  todayRequest,
  onPageChange,
}: CalendarProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useCalendarSwipe(containerRef, onPageChange);
  useCalendarSlide(containerRef, pageStart);

  const { columnsPerRow, paneWidth } = usePaneWidth(containerRef);
  const rows = splitDaysIntoRows(dayCount, columnsPerRow, dayCount % 7 === 0);

  const layoutSignature = `${rows.length}:${timeFrame.join('-')}`;
  const { cellHeight } = useCalendarZoom(containerRef, layoutSignature);

  useCalendarRevealToday(containerRef, todayRequest);

  const today = Temporal.Now.plainDateISO();

  let dayOffset = 0;
  const rowRanges = rows.map((days) => {
    const start = pageStart.add({ days: dayOffset });
    dayOffset += days;
    const todayOffset = start.until(today).days;
    return {
      start,
      days,
      // Which of this row's columns is today, if today is on this row at all.
      // Handed to CSS, which narrows mobiscroll's current-time line — drawn
      // across the whole instance — onto that one column.
      todayIndex: todayOffset >= 0 && todayOffset < days ? todayOffset : null,
    };
  });

  return (
    <div
      className={isDarkModeEnabled ? 'calendar calendar-dark' : 'calendar'}
      ref={containerRef}
      style={
        {
          // Unitless so CSS can compare it against the fade thresholds; the
          // length is derived in Calendar.css. See zoom-detail.ts.
          '--calendar-cell-px': cellHeight,
          '--calendar-slide-duration': `${SLIDE_DURATION_MS}ms`,
          ...getTimeGutterStyles(paneWidth),
          ...zoomDetailStyles,
        } as React.CSSProperties
      }
    >
      {rowRanges.map(({ start, days, todayIndex }, rowIndex) => (
        <div
          className={[
            'calendar-week-row',
            // A one-day row still gets a whole week of day names; Calendar.css
            // drops the six that are not this row's day.
            days === 1 ? 'calendar-week-row-single' : '',
            todayIndex === null ? '' : 'calendar-week-row-has-today',
          ]
            .filter(Boolean)
            .join(' ')}
          key={rowIndex}
          style={
            todayIndex === null
              ? undefined
              : ({
                  '--calendar-today-index': todayIndex,
                  '--calendar-row-days': days,
                } as React.CSSProperties)
          }
        >
          <Eventcalendar
            // Pinned, not left on mobiscroll's `auto`. Auto picks by platform,
            // so the same build renders `mbsc-ios` in one environment and
            // `mbsc-material` in another — and every override in Calendar.css
            // is scoped `.mbsc-ios` to outrank mobiscroll's own two-class
            // rules, so under material they all silently stop applying. That
            // was live: the hour labels lost `white-space: nowrap` and wrapped
            // onto two lines, and the bottom strip's hairline (which reads the
            // iOS border token) stopped matching the columns' material one.
            theme="ios"
            themeVariant={isDarkModeEnabled ? 'dark' : 'light'}
            refDate={toJsDate(start)}
            selectedDate={toJsDate(start)}
            view={getSchedulerViewOption(days, timeFrame)}
            data={events}
            // Empties the header rather than hiding it. CSS already hides the
            // box, but during a resize the month/year title flashed in the
            // corner above the gutter anyway — with nothing rendered into it
            // there is no longer anything that can flash.
            renderHeader={() => null}
          />
        </div>
      ))}

      {/* Carries the grid past the last row and under the home indicator, so
          the stack reaches the bottom of the screen while its events still
          come to rest above the inset. One cell per column of the *last* row,
          which can be narrower than the rest — [4,3] ends on three. */}
      <div className="calendar-bottom-strip" aria-hidden="true">
        {Array.from({ length: rowRanges[rowRanges.length - 1]?.days ?? 0 }).map(
          (_, columnIndex) => (
            // `mbsc-hb` is mobiscroll's hairline-border class, and the day
            // columns carry it too. At DPR >= 2 it forces `border-width: .5px`,
            // which WebKit then snaps to a single device pixel — 0.333px at 3x.
            // Without it our border stays a full CSS px and the strip's lines
            // render three device pixels wide against the columns' one. That is
            // invisible in the preview browser at DPR 1, where the rule does not
            // apply at all and both measure 1px. See docs/calendar-layout.md.
            <div className="mbsc-hb" key={columnIndex} />
          ),
        )}
      </div>
    </div>
  );
};
