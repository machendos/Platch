import {
  createTimezoneChange,
  refreshTimezoneChanges,
  useTimezoneChangesQuery,
} from '../../api/timezone.change';
import { Temporal } from 'temporal-polyfill';

const canonical = (zone: string) =>
  new Intl.DateTimeFormat('en', { timeZone: zone }).resolvedOptions().timeZone;

const currentDeviceTz = () =>
  canonical(Intl.DateTimeFormat().resolvedOptions().timeZone);

const dateStartInTz = (date: Temporal.PlainDate, tz: string) =>
  date.toPlainDateTime('00:00').toZonedDateTime(tz).toInstant();

export const useTimezone = () => {
  const history = useTimezoneChangesQuery();

  const getTimezoneOnMoment = (
    history: { changesAt: Temporal.Instant; ianaTimezone: string }[],
    moment: Date,
  ) => {
    const futureChangeIndex = history.findIndex(
      ({ changesAt }) =>
        changesAt > Temporal.Instant.fromEpochMilliseconds(moment.getTime()),
    );

    return history.length === 0
      ? currentDeviceTz()
      : futureChangeIndex === -1
        ? history[history.length - 1].ianaTimezone
        : futureChangeIndex === 0
          ? history[0].ianaTimezone
          : history[futureChangeIndex - 1].ianaTimezone;
  };

  const recalculateCurrentTimezone = async () => {
    const currentDeviceTz = canonical(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );

    const refreshedHistory = await refreshTimezoneChanges();

    const expectedTimezone = getTimezoneOnMoment(refreshedHistory, new Date());

    if (expectedTimezone !== currentDeviceTz) {
      await createTimezoneChange({
        ianaTimezone: currentDeviceTz,
        changesAt: new Date().toISOString(),
      });
    }
  };

  const getTimezoneOffsetOnDates = ([rangeStart, rangeEnd]: [
    Temporal.PlainDate,
    Temporal.PlainDate,
  ]) => {
    const currentDeviceTimezone = currentDeviceTz();

    const finalOffsets: number[] = [];

    const seedDate = dateStartInTz(rangeStart.subtract({ days: 2 }), 'UTC');

    let indexOfNextChange = history.findIndex(
      ({ changesAt }) => Temporal.Instant.compare(seedDate, changesAt) === -1,
    );

    const historyLength = history.length;

    indexOfNextChange =
      indexOfNextChange === 0 ? indexOfNextChange + 1 : indexOfNextChange;

    let {
      currentTimezone,
      nextChangesAt,
    }: { currentTimezone: string; nextChangesAt?: Temporal.Instant } =
      historyLength === 0
        ? { currentTimezone: currentDeviceTimezone }
        : indexOfNextChange === -1
          ? { currentTimezone: history[historyLength - 1].ianaTimezone }
          : {
              currentTimezone: history[indexOfNextChange - 1].ianaTimezone,
              nextChangesAt: history[indexOfNextChange]?.changesAt,
            };

    for (
      let date = rangeStart;
      Temporal.PlainDate.compare(date, rangeEnd) < 1;
      date = date.add({ days: 1 })
    ) {
      let beginningOfTheDay = dateStartInTz(date, currentTimezone);

      while (
        nextChangesAt &&
        Temporal.Instant.compare(beginningOfTheDay, nextChangesAt) >= 0
      ) {
        currentTimezone = history[indexOfNextChange].ianaTimezone;
        nextChangesAt = history[++indexOfNextChange]?.changesAt;
        beginningOfTheDay = dateStartInTz(date, currentTimezone);
      }

      const offsetMinutes = dateStartInTz(date, currentTimezone)
        .until(dateStartInTz(date, currentDeviceTimezone))
        .total({ unit: 'minutes' });
      finalOffsets.push(offsetMinutes);
    }

    return finalOffsets;
  };

  return {
    recalculateCurrentTimezone,
    getTimezoneOnDates: (
      datesRange: [Temporal.PlainDate, Temporal.PlainDate],
    ) => getTimezoneOffsetOnDates(datesRange),
    getTimezoneOnMoment: (moment: Date) => getTimezoneOnMoment(history, moment),
    currentTimezone: currentDeviceTz(),
  };
};
