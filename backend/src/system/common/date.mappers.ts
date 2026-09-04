import { Temporal } from '@js-temporal/polyfill';
import {
  DateString,
  DateTimeString,
  TimeString,
} from '../validation/validation.decorators';

export const plainDateToDate = (value?: Temporal.PlainDate | null) =>
  value ? new Date(Date.UTC(value.year, value.month - 1, value.day)) : value;

export const plainTimeToDate = (value?: Temporal.PlainTime | null) =>
  value
    ? new Date(
        Date.UTC(
          1970,
          0,
          1,
          value.hour,
          value.minute,
          value.second,
          value.millisecond,
        ),
      )
    : value;

export const plainDateTimeToDate = (value?: Temporal.PlainDateTime | null) =>
  value
    ? new Date(
        Date.UTC(
          value.year,
          value.month - 1,
          value.day,
          value.hour,
          value.minute,
          value.second,
          value.millisecond,
        ),
      )
    : value;

export const stringToPlainDate = (value?: DateString | null) =>
  value === null || value === undefined
    ? value
    : Temporal.PlainDate.from(value);

export const stringToPlainTime = (value?: TimeString | null) =>
  value === null || value === undefined
    ? value
    : Temporal.PlainTime.from(value);

export const stringToPlainDateTime = (value?: DateTimeString) =>
  value === undefined ? undefined : Temporal.PlainDateTime.from(value);
