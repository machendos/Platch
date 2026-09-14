/* The strips a timezone change leaves on the grid.
 *
 * A change happens at one instant, and that instant has two clock readings —
 * one on the zone being left, one on the zone being entered. The strip is the
 * span between them, and which of the two comes first is the only thing that
 * decides what kind of strip it is:
 *
 *   forward   old 04:00 -> new 07:00   those readings never happened  -> dead
 *   backward  old 07:00 -> new 04:00   those readings happened twice  -> doubled
 *
 * So one calculation covers both directions, and the sign picks the rest.
 *
 * DST leaves the same two shapes but cannot be computed here: a zone changing
 * against itself has no second zone to read the instant in. Those come from
 * the zone's own transitions instead — see docs/calendar-layout.md.
 */

import { Temporal } from 'temporal-polyfill';
import { serializeTimezoneOffset } from '../../../system/helpers/dateTimeSerializers';

export type TimezoneChangeRow = {
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

const toJsDate = (moment: Temporal.PlainDateTime) =>
  new Date(
    moment.year,
    moment.month - 1,
    moment.day,
    moment.hour,
    moment.minute,
  );

const NANOSECONDS_PER_MINUTE = 60_000_000_000;

const shiftMinutes = (at: Temporal.Instant, from: string, to: string) =>
  (at.toZonedDateTimeISO(to).offsetNanoseconds -
    at.toZonedDateTimeISO(from).offsetNanoseconds) /
  NANOSECONDS_PER_MINUTE;

/* "Miami +3". `cityLabel` is used as it stands rather than taken apart: it can
   itself contain a comma — "Glendale, AZ" carries the state that tells two of
   them apart — so there is no separator left to split on. The country is
   stored beside it and deliberately left out here, since a strip has room for
   a place and a number and little else.

   The fallback is for a change nobody typed a place into: an observed one
   records only what the device reported. */
const label = (row: TimezoneChangeRow, minutes: number) => {
  const place =
    row.cityLabel ??
    row.ianaTimezone.split('/').at(-1)?.replaceAll('_', ' ') ??
    row.ianaTimezone;

  return `${place} ${serializeTimezoneOffset(minutes) ?? ''}`.trim();
};

/**
 * Strips for every change between consecutive rows, clipped to the days asked
 * for. `history` must be sorted ascending — the gateway's `select` guarantees
 * it, and the pairing below is meaningless without it.
 */
export const timezoneBands = (
  history: readonly TimezoneChangeRow[],
  [rangeStart, rangeEnd]: [Temporal.PlainDate, Temporal.PlainDate],
): TimezoneBand[] => {
  const bands: TimezoneBand[] = [];

  for (let index = 1; index < history.length; index += 1) {
    const previousChange = history[index - 1];
    const currentChange = history[index];

    const before = currentChange.changesAt
      .toZonedDateTimeISO(previousChange.ianaTimezone)
      .toPlainDateTime();
    const after = currentChange.changesAt
      .toZonedDateTimeISO(currentChange.ianaTimezone)
      .toPlainDateTime();

    const direction = Temporal.PlainDateTime.compare(after, before);
    // Two zones an equal distance from UTC on the day they are swapped leave
    // nothing to draw, and a zero-width range confuses mobiscroll.
    if (direction === 0) continue;

    const [start, end] = direction > 0 ? [before, after] : [after, before];

    // A strip can begin before the range and end inside it, so both ends are
    // compared rather than just the start.
    if (
      Temporal.PlainDate.compare(end.toPlainDate(), rangeStart) < 0 ||
      Temporal.PlainDate.compare(start.toPlainDate(), rangeEnd) > 0
    ) {
      continue;
    }

    bands.push({
      kind: direction > 0 ? 'dead' : 'doubled',
      start: toJsDate(start),
      end: toJsDate(end),
      title: label(
        currentChange,
        shiftMinutes(
          currentChange.changesAt,
          previousChange.ianaTimezone,
          currentChange.ianaTimezone,
        ),
      ),
    });
  }

  return bands;
};
