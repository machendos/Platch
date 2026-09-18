/* What the calendar reads off the timeline: how far each day is offset from
   the device's own zone, and the strips a change leaves between them. */

import { Temporal } from 'temporal-polyfill';
import { useTimezoneHistory } from './api/timezoneChanges';
import { timezoneBands } from './timezoneBands';
import { deviceZone } from './helpers';

type DateRange = [Temporal.PlainDate, Temporal.PlainDate];

const startOfDayIn = (date: Temporal.PlainDate, zone: string) =>
  date.toPlainDateTime('00:00').toZonedDateTime(zone).toInstant();

/** The zone in force at a moment, or null if the timeline is empty. */
export const zoneAtMoment = (
  history: { changesAt: Temporal.Instant; ianaTimezone: string }[],
  moment: Date,
): string | null => {
  if (history.length === 0) return null;

  const momentAsInstant = Temporal.Instant.fromEpochMilliseconds(
    moment.getTime(),
  );

  const firstChangeAfterMoment = history.findIndex(
    ({ changesAt }) => Temporal.Instant.compare(changesAt, momentAsInstant) > 0,
  );

  return firstChangeAfterMoment === -1
    ? history[history.length - 1].ianaTimezone
    : firstChangeAfterMoment === 0
      ? history[0].ianaTimezone
      : history[firstChangeAfterMoment - 1].ianaTimezone;
};

export const useTimezone = () => {
  const history = useTimezoneHistory();

  /** Offset in minutes between each day's zone and the device's zone. */
  const getOffsetMinutesPerDay = ([rangeStart, rangeEnd]: DateRange) => {
    const deviceTimezone = deviceZone();

    const offsetsPerDay: number[] = [];

    const seedInstant = startOfDayIn(rangeStart.subtract({ days: 2 }), 'UTC');

    let indexOfNextChange = history.findIndex(
      ({ changesAt }) =>
        Temporal.Instant.compare(seedInstant, changesAt) === -1,
    );

    const changeCount = history.length;

    indexOfNextChange =
      indexOfNextChange === 0 ? indexOfNextChange + 1 : indexOfNextChange;

    let {
      zoneOnThisDay,
      nextChangesAt,
    }: { zoneOnThisDay: string; nextChangesAt?: Temporal.Instant } =
      changeCount === 0
        ? { zoneOnThisDay: deviceTimezone }
        : indexOfNextChange === -1
          ? { zoneOnThisDay: history[changeCount - 1].ianaTimezone }
          : {
              zoneOnThisDay: history[indexOfNextChange - 1].ianaTimezone,
              nextChangesAt: history[indexOfNextChange]?.changesAt,
            };

    for (
      let date = rangeStart;
      Temporal.PlainDate.compare(date, rangeEnd) < 1;
      date = date.add({ days: 1 })
    ) {
      let dayStart = startOfDayIn(date, zoneOnThisDay);

      while (
        nextChangesAt &&
        Temporal.Instant.compare(dayStart, nextChangesAt) >= 0
      ) {
        zoneOnThisDay = history[indexOfNextChange].ianaTimezone;
        nextChangesAt = history[++indexOfNextChange]?.changesAt;
        dayStart = startOfDayIn(date, zoneOnThisDay);
      }

      offsetsPerDay.push(
        startOfDayIn(date, zoneOnThisDay)
          .until(startOfDayIn(date, deviceTimezone))
          .total({ unit: 'minutes' }),
      );
    }

    return offsetsPerDay;
  };

  return {
    getOffsetMinutesPerDay,
    getTimezoneBands: (range: DateRange) => timezoneBands(history, range),
    getTimezoneAtMoment: (moment: Date) => zoneAtMoment(history, moment),
  };
};
