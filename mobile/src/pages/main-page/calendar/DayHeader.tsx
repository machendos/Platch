/* The content of one day column's header: weekday, date, and how far that
   day's clock sits from the device's.

   Rendered by us rather than by mobiscroll, because mobiscroll picks the
   weekday's length and whether it shares a line with the date from a measured
   width — three different shapes across two thresholds. The string is chosen
   in JS, so no stylesheet can pin it to one. See docs/calendar-layout.md.

   Mobiscroll's own class names are kept so its day-today badge and its colour
   and weight rules keep applying; only the layout is ours. `mbsc-ios` goes on
   with them because those rules are theme-scoped — `.mbsc-ios.mbsc-schedule-
   header-day-today` — and match nothing without it. Calendar.tsx pins the
   theme to ios for the same reason its stylesheet does.

   `mbsc-selected` is deliberately not mirrored. Every instance sets
   `selectedDate` to its own row's first day purely to position the row, so the
   mark says nothing to the reader — which is why Calendar.css already undoes
   its look. Today's badge is drawn there instead. */

import { Temporal } from 'temporal-polyfill';
import {
  serializeTimezoneOffset,
  serializeWeekday,
} from '../../../system/helpers/dateTimeSerializers';

type DayHeaderProps = {
  date: Temporal.PlainDate;
  isToday: boolean;
  /** Absent for a day outside the requested range — see Calendar.tsx. */
  offsetMinutes: number | undefined;
};

const classes = (...names: (string | false)[]) =>
  names.filter(Boolean).join(' ');

export const DayHeader = ({
  date,
  isToday,
  offsetMinutes,
}: DayHeaderProps) => {
  const offset =
    offsetMinutes === undefined ? null : serializeTimezoneOffset(offsetMinutes);

  return (
    <span className="calendar-day-header">
      <span
        className={classes(
          'mbsc-schedule-header-dayname mbsc-ios',
          isToday && 'mbsc-schedule-header-dayname-curr',
        )}
      >
        {serializeWeekday(date)}
      </span>{' '}
      <span
        className={classes(
          'mbsc-schedule-header-day mbsc-ios',
          isToday && 'mbsc-schedule-header-day-today',
        )}
      >
        {date.day}
      </span>
      {offset && <sup className="calendar-day-header-offset">{offset}</sup>}
    </span>
  );
};
