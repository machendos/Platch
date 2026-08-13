import { Temporal } from 'temporal-polyfill';

export const toJsDate = (date: Temporal.PlainDate) =>
  new Date(date.year, date.month - 1, date.day);

export const fromJsDate = (date: Date) =>
  new Temporal.PlainDate(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  );

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);
