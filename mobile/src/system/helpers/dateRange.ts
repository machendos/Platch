import { Temporal } from 'temporal-polyfill';

export type DateRange = {
  start: Temporal.PlainDate;
  end: Temporal.PlainDate;
};
