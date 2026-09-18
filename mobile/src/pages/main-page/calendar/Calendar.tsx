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
import { fromJsDate, toJsDate } from '../../../system/helpers/helpers';
import {
  DEFAULT_CELL_STEP_MINUTES,
  DEFAULT_LABEL_STEP_MINUTES,
  dayHeaderFontSize,
  dayHeaderLabelChars,
  dayHeaderOffsetChars,
  dayHeaderStyles,
  timezoneBandStyles,
  getTimeGutterStyles,
  schedulerAreaWidth,
  zoomDetailStyles,
  SLIDE_DURATION_MS,
} from './layoutConfig';
import { DayHeader } from './DayHeader';
import type { TimezoneBand } from '../../../features/timezone/timezoneBands';
import { useTimezone } from '../../../features/timezone/useTimezone';

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

  const { getOffsetMinutesPerDay, getTimezoneBands } = useTimezone();
  const timezoneOffsetByDay = new Map<string, number>(
    getOffsetMinutesPerDay([
      pageStart,
      pageStart.add({ days: dayCount - 1 }),
    ]).map((offsetMinutes, index): [string, number] => [
      pageStart.add({ days: index }).toString(),
      offsetMinutes,
    ]),
  );

  const pageEnd = pageStart.add({ days: dayCount - 1 });
  const bands = getTimezoneBands([pageStart, pageEnd]);

  /* A strip belongs to every row whose days it touches — it can start on the
     last day of one row and finish on the first day of the next. */
  const bandsForRow = (start: Temporal.PlainDate, days: number) => {
    const end = start.add({ days: days - 1 });
    return bands.filter(
      (band) =>
        Temporal.PlainDate.compare(fromJsDate(band.start), end) <= 0 &&
        Temporal.PlainDate.compare(fromJsDate(band.end), start) >= 0,
    );
  };

  const ofKind = (rowBands: TimezoneBand[], kind: TimezoneBand['kind']) =>
    rowBands
      .filter((band) => band.kind === kind)
      .map(({ start, end, title }) => ({
        start,
        end,
        title,
        cssClass: `calendar-tz-band calendar-tz-${kind}`,
      }));

  let dayOffset = 0;
  const rowRanges = rows.map((days) => {
    const start = pageStart.add({ days: dayOffset });
    dayOffset += days;
    const todayOffset = start.until(today).days;

    const columnWidth = schedulerAreaWidth(paneWidth) / days;
    const fontSize = Math.min(
      ...Array.from({ length: days }, (_, index) => {
        const date = start.add({ days: index });
        return dayHeaderFontSize(
          columnWidth,
          dayHeaderLabelChars(date),
          dayHeaderOffsetChars(timezoneOffsetByDay.get(date.toString())),
        );
      }),
    );

    const rowBands = bandsForRow(start, days);

    return {
      start,
      days,
      fontSize,
      invalidBands: ofKind(rowBands, 'dead'),
      colorBands: ofKind(rowBands, 'doubled'),
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
          ...dayHeaderStyles,
          ...timezoneBandStyles,
        } as React.CSSProperties
      }
    >
      {rowRanges.map(
        (
          { start, days, todayIndex, fontSize, invalidBands, colorBands },
          rowIndex,
        ) => (
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
              {
                '--calendar-day-header-font-size': `${fontSize}px`,
                ...(todayIndex === null
                  ? {}
                  : {
                      '--calendar-today-index': todayIndex,
                      '--calendar-row-days': days,
                    }),
              } as React.CSSProperties
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
              /* A forward change leaves clock readings that never happened, so
               they are marked invalid rather than merely shaded — that also
               stops drag-to-create, move and resize landing in them, which
               `invalidateEvent` handles at its 'strict' default. A backward
               change leaves readings that happened twice, which are ordinary
               schedulable time and only need marking. */
              invalid={invalidBands}
              colors={colorBands}
              // Empties the header rather than hiding it. CSS already hides the
              // box, but during a resize the month/year title flashed in the
              // corner above the gutter anyway — with nothing rendered into it
              // there is no longer anything that can flash.
              renderHeader={() => null}
              /* `renderSchedulerDay`, not `renderSchedulerDayContent`: the
               header item renders `renderDay ? ours : <builtins>`, while
               `renderDayContent` is appended *after* the built-in dayname and
               date, which shows both. The wrapper cell and its sticky
               positioning sit outside that branch either way, so this replaces
               only the content. */
              renderSchedulerDay={({ date }) => {
                const day = fromJsDate(date);
                return (
                  <DayHeader
                    date={day}
                    isToday={day.equals(today)}
                    offsetMinutes={timezoneOffsetByDay.get(day.toString())}
                  />
                );
              }}
            />
          </div>
        ),
      )}

      {/* Carries the grid past the last row and under the home indicator, so
          the stack reaches the bottom of the screen while its events still
          come to rest above the inset. One cell per column of the *last* row,
          which can be narrower than the rest — [4,3] ends on three. */}
      <div className="calendar-bottom-strip" aria-hidden="true">
        {Array.from({ length: rowRanges[rowRanges.length - 1]?.days ?? 0 }).map(
          (_, columnIndex) => (
            <div key={columnIndex} />
          ),
        )}
      </div>
    </div>
  );
};
