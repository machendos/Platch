import { Temporal } from '@js-temporal/polyfill';
import {
  DateString,
  DateTimeString,
  TimeString,
} from '../validation/validation.decorators';

export const plainDateToDate = (value?: Temporal.PlainDate) =>
  value
    ? new Date(Date.UTC(value.year, value.month - 1, value.day))
    : undefined;

export const plainTimeToDate = (value?: Temporal.PlainTime) =>
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
    : undefined;

export const plainDateTimeToDate = (value?: Temporal.PlainDateTime) =>
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
    : undefined;

export const stringToPlainDate = (value?: DateString) =>
  value === undefined ? undefined : Temporal.PlainDate.from(value);

export const stringToPlainTime = (value?: TimeString) =>
  value === undefined ? undefined : Temporal.PlainTime.from(value);

export const stringToPlainDateTime = (value?: DateTimeString) =>
  value === undefined ? undefined : Temporal.PlainDateTime.from(value);
