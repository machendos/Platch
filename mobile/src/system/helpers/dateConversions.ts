/* Every conversion between the three date vocabularies this app speaks:
   Temporal values in our own code, JS `Date` at a library boundary, and the
   zone-free strings the API exchanges. Named input-to-output so a call site
   says which way it goes and no two of them can share a name.

   Two traps are the reason these are centralised rather than written inline.
   A `Date` built from UTC fields is read back through the browser's local
   calendar, so a wall clock stamped that way is redrawn shifted by the
   viewer's offset — the `toDate` pair below therefore use the local-fields
   constructor, which is what makes a PlainDateTime arrive on screen saying
   what it said in memory. And every date the API sends is a full ISO instant
   whatever column it came from, so a `@db.Date` returns midnight-stamped and a
   `@db.Time` returns on the epoch day; reading `1970-01-01T17:45:00.000Z`
   through a local calendar moves a 5:45 PM deadline by hours, which is why the
   marker is stripped before parsing. */

import { Temporal } from 'temporal-polyfill';

export const fromPlainDateToDate = (date: Temporal.PlainDate) =>
  new Date(date.year, date.month - 1, date.day);

export const fromPlainDateTimeToDate = (moment: Temporal.PlainDateTime) =>
  new Date(
    moment.year,
    moment.month - 1,
    moment.day,
    moment.hour,
    moment.minute,
    moment.second,
  );

export const fromDateToPlainDate = (date: Date) =>
  new Temporal.PlainDate(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  );

const withoutZone = (value: string) => value.replace(/(\.\d+)?Z?$/i, '');

export const fromApiStringToPlainDateTime = (
  value: string,
): Temporal.PlainDateTime => Temporal.PlainDateTime.from(withoutZone(value));

export const fromPlainDateToApiString = (date: Temporal.PlainDate) =>
  date.toPlainDateTime().toString({ smallestUnit: 'minute' });

export const fromPlainDateTimeToApiString = (moment: Temporal.PlainDateTime) =>
  moment.toString({ smallestUnit: 'minute' });

export const fromPlainTimeToApiString = (time: Temporal.PlainTime) =>
  time.toString({ smallestUnit: 'minute' });

export const fromPlainDateToInstant = (
  date: Temporal.PlainDate,
  zone: string,
) => date.toPlainDateTime('00:00').toZonedDateTime(zone).toInstant();
