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

const stripZone = (value: string) => value.replace(/(\.\d+)?Z?$/i, '');

export const fromApiStringToPlainDateTime = (
  value: string,
): Temporal.PlainDateTime => Temporal.PlainDateTime.from(stripZone(value));

export const fromApiStringToPlainDate = (value: string): Temporal.PlainDate =>
  fromApiStringToPlainDateTime(value).toPlainDate();

export const fromApiStringToPlainTime = (value: string): Temporal.PlainTime =>
  fromApiStringToPlainDateTime(value).toPlainTime();

export const fromPlainDateToApiDate = (date: Temporal.PlainDate) =>
  date.toString();

export const fromPlainDateToApiDateTime = (date: Temporal.PlainDate) =>
  date.toPlainDateTime().toString({ smallestUnit: 'minute' });

export const fromPlainDateTimeToApiDateTime = (moment: Temporal.PlainDateTime) =>
  moment.toString({ smallestUnit: 'minute' });

export const fromPlainTimeToApiTime = (time: Temporal.PlainTime) =>
  time.toString({ smallestUnit: 'minute' });

export const fromPlainDateToInstant = (
  date: Temporal.PlainDate,
  zone: string,
) => date.toPlainDateTime('00:00').toZonedDateTime(zone).toInstant();
