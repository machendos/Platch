import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import {
  toEventDraft,
  isEventDraftValid,
  createEventDraft,
  toEvent,
  changeEventStart,
} from './eventState';
import type { Event } from '../../../api/event';

const time = (hour: number, minute: number) =>
  new Temporal.PlainTime(hour, minute);

const date = (year: number, month: number, day: number) =>
  new Temporal.PlainDate(year, month, day);

export const event = (over: Partial<Event> = {}): Event => ({
  id: 'a1',
  projectId: 'p1',
  recurringTimeComponentId: null,
  overridedName: null,
  overridedGoal: null,
  overridedContext: null,
  start: new Temporal.PlainDateTime(2026, 6, 19, 17, 45),
  end: new Temporal.PlainDateTime(2026, 6, 19, 18, 45),
  recurringOccurrenceIndex: null,
  recurringTimeSlotsId: null,
  ...over,
});

describe('toEventDraft', () => {
  it('splits a stored span into date and time', () => {
    const draft = toEventDraft(event());

    expect(draft.fromDate?.toString()).toBe('2026-06-19');
    expect(draft.fromTime?.toString({ smallestUnit: 'minute' })).toBe('17:45');
    expect(draft.toTime?.toString({ smallestUnit: 'minute' })).toBe('18:45');
  });
});

describe('toEvent', () => {
  it('rejoins the split date and time into one span', () => {
    const rejoined = toEvent(toEventDraft(event()));

    expect(rejoined.start?.toString()).toBe('2026-06-19T17:45:00');
    expect(rejoined.end?.toString()).toBe('2026-06-19T18:45:00');
  });

  it('leaves a half-filled end null rather than guessing it', () => {
    const halfFilled = { ...toEventDraft(event()), toTime: null };

    expect(toEvent(halfFilled).end).toBeNull();
  });
});

describe('changeEventStart', () => {
  it('slides the range whole, dates included', () => {
    const range = toEventDraft(event());

    const laterTime = changeEventStart(range, range.fromDate, time(9, 0));
    expect(laterTime.toTime).toEqual(time(10, 0));
    expect(laterTime.toDate).toEqual(range.fromDate);

    const otherDay = changeEventStart(range, date(2026, 6, 21), range.fromTime);
    expect(otherDay.toDate).toEqual(date(2026, 6, 21));
    expect(otherDay.toTime).toEqual(time(18, 45));

    const overMidnight = changeEventStart(range, range.fromDate, time(23, 30));
    expect(overMidnight.toDate).toEqual(date(2026, 6, 20));
    expect(overMidnight.toTime).toEqual(time(0, 30));
  });

  it('a partial start still brings sensible defaults', () => {
    const empty = createEventDraft();

    const dateOnly = changeEventStart(empty, date(2026, 6, 19), null);
    expect(dateOnly.toDate).toEqual(date(2026, 6, 19));

    const timeOnly = changeEventStart(empty, null, time(23, 30));
    expect(timeOnly.toTime).toEqual(time(23, 55));
  });
});

describe('validity', () => {
  it('rejects a range missing a field, running backwards, or empty', () => {
    const draft = toEventDraft(event());

    expect(isEventDraftValid(draft)).toBe(true);
    expect(isEventDraftValid({ ...draft, toTime: null })).toBe(false);
    expect(isEventDraftValid({ ...draft, toDate: date(2026, 6, 18) })).toBe(
      false,
    );
    expect(isEventDraftValid({ ...draft, toTime: time(17, 45) })).toBe(false);
  });
});
