import { Temporal } from '@js-temporal/polyfill';
import {
  DateString,
  DateTimeString,
  TimeString,
} from '../validation/validation.decorators';

export function plainDateToDate(value: Temporal.PlainDate): Date;
export function plainDateToDate(
  value?: Temporal.PlainDate | null,
): Date | null | undefined;
export function plainDateToDate(value?: Temporal.PlainDate | null) {
  return value
    ? new Date(Date.UTC(value.year, value.month - 1, value.day))
    : value;
}

export function plainTimeToDate(value: Temporal.PlainTime): Date;
export function plainTimeToDate(
  value?: Temporal.PlainTime | null,
): Date | null | undefined;
export function plainTimeToDate(value?: Temporal.PlainTime | null) {
  return value
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
}

export function plainDateTimeToDate(value: Temporal.PlainDateTime): Date;
export function plainDateTimeToDate(
  value?: Temporal.PlainDateTime | null,
): Date | null | undefined;
export function plainDateTimeToDate(value?: Temporal.PlainDateTime | null) {
  return value
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
}

export function stringToPlainDate(value: DateString): Temporal.PlainDate;
export function stringToPlainDate(
  value?: DateString | null,
): Temporal.PlainDate | null | undefined;
export function stringToPlainDate(value?: DateString | null) {
  return value === null || value === undefined
    ? value
    : Temporal.PlainDate.from(value);
}

export function stringToPlainTime(value: TimeString): Temporal.PlainTime;
export function stringToPlainTime(
  value?: TimeString | null,
): Temporal.PlainTime | null | undefined;
export function stringToPlainTime(value?: TimeString | null) {
  return value === null || value === undefined
    ? value
    : Temporal.PlainTime.from(value);
}

export function stringToPlainDateTime(
  value: DateTimeString,
): Temporal.PlainDateTime;
export function stringToPlainDateTime(
  value?: DateTimeString,
): Temporal.PlainDateTime | undefined;
export function stringToPlainDateTime(value?: DateTimeString) {
  return value === undefined ? undefined : Temporal.PlainDateTime.from(value);
}
