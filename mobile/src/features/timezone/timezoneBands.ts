/* The strips a timezone change leaves on the grid.
 *
 * A change is one instant read in two zones. If the new reading is later,
 * those hours were skipped (dead); if it is earlier, they happened twice
 * (doubled).
 *
 * Strips are clipped so they never overlap. That is only about drawing: do not
 * use a strip's width to decide which local times exist. See docs/timezone.md.
 */

import { Temporal } from 'temporal-polyfill';
import { fromPlainDateTimeToDate } from '../../system/helpers/dateConversions';
import { serializeTimezoneOffset } from '../../system/helpers/dateTimeSerializers';

export type TimezoneChange = {
  ianaTimezone: string;
  changesAt: Temporal.Instant;
  cityLabel?: string | null;
};

export type TimezoneBand = {
  kind: 'dead' | 'doubled';
  start: Date;
  end: Date;
  title: string;
};

const NANOSECONDS_PER_MINUTE = 60_000_000_000;

const shiftMinutes = (at: Temporal.Instant, from: string, to: string) =>
  (at.toZonedDateTimeISO(to).offsetNanoseconds -
    at.toZonedDateTimeISO(from).offsetNanoseconds) /
  NANOSECONDS_PER_MINUTE;

const bandLabel = (row: TimezoneChange, minutes: number) => {
  const place =
    row.cityLabel ??
    row.ianaTimezone.split('/').at(-1)?.replaceAll('_', ' ') ??
    row.ianaTimezone;

  return `${place} ${serializeTimezoneOffset(minutes) ?? ''}`.trim();
};

/* Walks backwards so the most recent strip keeps its full width and earlier
   ones are clipped to fit. */
const withoutOverlap = (bands: TimezoneBand[]): TimezoneBand[] => {
  const nonOverlapping: TimezoneBand[] = [];
  let earliestClaimedStart = Infinity;

  for (let index = bands.length - 1; index >= 0; index -= 1) {
    const band = bands[index];
    const end = Math.min(band.end.getTime(), earliestClaimedStart);

    if (band.start.getTime() >= end) continue;

    nonOverlapping.push({ ...band, end: new Date(end) });
    earliestClaimedStart = Math.min(earliestClaimedStart, band.start.getTime());
  }

  return nonOverlapping.reverse();
};

/** Strips for the days asked for. `history` must be sorted ascending. */
export const timezoneBands = (
  history: readonly TimezoneChange[],
  [rangeStart, rangeEnd]: [Temporal.PlainDate, Temporal.PlainDate],
): TimezoneBand[] => {
  const bands: TimezoneBand[] = [];

  for (let index = 1; index < history.length; index += 1) {
    const previousChange = history[index - 1];
    const currentChange = history[index];

    const readingInOldZone = currentChange.changesAt
      .toZonedDateTimeISO(previousChange.ianaTimezone)
      .toPlainDateTime();
    const readingInNewZone = currentChange.changesAt
      .toZonedDateTimeISO(currentChange.ianaTimezone)
      .toPlainDateTime();

    const shiftDirection = Temporal.PlainDateTime.compare(
      readingInNewZone,
      readingInOldZone,
    );
    if (shiftDirection === 0) continue;

    const [start, end] =
      shiftDirection > 0
        ? [readingInOldZone, readingInNewZone]
        : [readingInNewZone, readingInOldZone];

    if (
      Temporal.PlainDate.compare(end.toPlainDate(), rangeStart) < 0 ||
      Temporal.PlainDate.compare(start.toPlainDate(), rangeEnd) > 0
    ) {
      continue;
    }

    bands.push({
      kind: shiftDirection > 0 ? 'dead' : 'doubled',
      start: fromPlainDateTimeToDate(start),
      end: fromPlainDateTimeToDate(end),
      title: bandLabel(
        currentChange,
        shiftMinutes(
          currentChange.changesAt,
          previousChange.ianaTimezone,
          currentChange.ianaTimezone,
        ),
      ),
    });
  }

  return withoutOverlap(bands);
};
