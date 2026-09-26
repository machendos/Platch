import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import type { RecurringTimeComponent } from '../../../api/project';
import {
  toRecurringTimeComponentDraft,
  isRecurringTimeComponentDraftValid,
  isSlotValid,
  createRecurringTimeComponentDraft,
  getSlotDurationMinutes,
  changeFirstRecurringEventAt,
  changeRecurringFrequency,
  changeSlotToFlexible,
  removeSlot,
  changeSlotTime,
} from './recurringTimeComponentsState';

const time = (hour: number, minute: number) =>
  new Temporal.PlainTime(hour, minute);

const date = (year: number, month: number, day: number) =>
  new Temporal.PlainDate(year, month, day);

const ANCHOR = new Temporal.PlainDate(2026, 6, 19);

export const recurring = (
  over: Partial<RecurringTimeComponent> = {},
): RecurringTimeComponent => ({
  id: 'r1',
  projectId: 'p1',
  recurringInterval: 2,
  recurringFrequency: 'WEEK',
  recurringByDay: ['TU'],
  recurringByMonthDay: null,
  recurringByMonth: null,
  firstRecurringEventAt: new Temporal.PlainDate(2026, 6, 1),
  lastRecurringEventAt: null,
  recurringTimeSlots: [
    {
      id: 's1',
      type: 'ABSOLUTE',
      from: new Temporal.PlainTime(17, 45),
      to: new Temporal.PlainTime(18, 45),
      flexibleMinutesNeeded: null,
      recurringTimeComponentId: 'r1',
    },
  ],
  ...over,
});

describe('toRecurringTimeComponentDraft', () => {
  it('keeps slot ids and reads times off the epoch date', () => {
    const draft = toRecurringTimeComponentDraft(recurring());

    expect(draft.recurringTimeSlots[0].id).toBe('s1');
    expect(
      draft.recurringTimeSlots[0].from?.toString({ smallestUnit: 'minute' }),
    ).toBe('17:45');
    expect(draft.firstRecurringEventAt?.toString()).toBe('2026-06-01');
  });
});

describe('slot ownership', () => {
  const slot = {
    key: 's',
    from: time(9, 0),
    to: time(10, 0),
    flexibleMinutesNeeded: null,
  };

  it('entering a flexible duration wipes the times', () => {
    expect(changeSlotToFlexible(slot, 90)).toMatchObject({
      from: null,
      to: null,
      flexibleMinutesNeeded: 90,
    });
  });

  it('entering a time wipes the flexible duration', () => {
    const flexible = changeSlotToFlexible(slot, 90);
    expect(changeSlotTime(flexible, 'from', time(9, 0))).toMatchObject({
      from: time(9, 0),
      flexibleMinutesNeeded: null,
    });
  });

  it('the end follows the start, keeping the current duration', () => {
    const empty = {
      key: 's',
      from: null,
      to: null,
      flexibleMinutesNeeded: null,
    };

    expect(changeSlotTime(empty, 'from', time(9, 0)).to).toEqual(time(10, 0));
    expect(changeSlotTime(empty, 'from', time(23, 30)).to).toEqual(time(0, 30));
    expect(changeSlotTime(slot, 'from', time(8, 0)).to).toEqual(time(9, 0));

    const long = { ...slot, to: time(11, 30) };
    expect(changeSlotTime(long, 'from', time(10, 0)).to).toEqual(time(12, 30));
    expect(changeSlotTime(long, 'from', time(23, 0)).to).toEqual(time(1, 30));

    const overnight = { ...slot, from: time(23, 0), to: time(1, 0) };
    expect(changeSlotTime(overnight, 'from', time(22, 0)).to).toEqual(time(0, 0));

    const fullDay = { ...slot, from: time(9, 0), to: time(9, 0) };
    expect(changeSlotTime(fullDay, 'from', time(11, 0)).to).toEqual(time(11, 0));
  });

  it('measures a slot wrap-aware', () => {
    expect(getSlotDurationMinutes(time(9, 0), time(10, 30))).toBe(90);
    expect(getSlotDurationMinutes(time(23, 0), time(1, 0))).toBe(120);
    expect(getSlotDurationMinutes(time(9, 0), time(9, 0))).toBe(24 * 60);
  });
});

describe('validity', () => {
  it('reads an end at or before the start as next day, equality as a full day', () => {
    const slot = {
      key: 's',
      from: time(10, 0),
      to: time(9, 0),
      flexibleMinutesNeeded: null,
    };

    expect(isSlotValid(slot)).toBe(true);
    expect(isSlotValid({ ...slot, to: time(10, 0) })).toBe(true);
    expect(isSlotValid({ ...slot, to: time(11, 0) })).toBe(true);
  });

  it('rejects a weekly cadence with no days and an empty slot list', () => {
    const draft = toRecurringTimeComponentDraft(recurring());

    expect(isRecurringTimeComponentDraftValid({ ...draft, recurringByDay: [] })).toBe(false);
    expect(isRecurringTimeComponentDraftValid({ ...draft, recurringTimeSlots: [] })).toBe(
      false,
    );
  });

  it('rejects a last date before the first', () => {
    const draft = toRecurringTimeComponentDraft(recurring());

    expect(
      isRecurringTimeComponentDraftValid({
        ...draft,
        lastRecurringEventAt: date(2026, 5, 1),
      }),
    ).toBe(false);
    expect(
      isRecurringTimeComponentDraftValid({
        ...draft,
        lastRecurringEventAt: draft.firstRecurringEventAt,
      }),
    ).toBe(true);
    expect(
      isRecurringTimeComponentDraftValid({
        ...draft,
        lastRecurringEventAt: date(2026, 7, 1),
      }),
    ).toBe(true);
  });
});

describe('cadence bounds', () => {
  it('carries both bounds onto the draft', () => {
    const draft = toRecurringTimeComponentDraft(
      recurring({ lastRecurringEventAt: date(2026, 7, 1) }),
    );

    expect(draft.firstRecurringEventAt?.toString()).toBe('2026-06-01');
    expect(draft.lastRecurringEventAt?.toString()).toBe('2026-07-01');
  });

  it('never rewrites the cadence when the first date moves', () => {
    const draft = createRecurringTimeComponentDraft(ANCHOR);
    expect(draft.recurringByDay).toEqual(['FR']);

    const moved = changeFirstRecurringEventAt(draft, date(2026, 6, 18));

    expect(moved.recurringByDay).toEqual(['FR']);
    expect(moved.recurringByMonthDay).toBe(19);
    expect(moved.recurringByMonth).toBe(6);
    expect(moved.firstRecurringEventAt?.toString()).toBe('2026-06-18');
  });

  it('moves the last date with the first, keeping the span', () => {
    const draft = {
      ...createRecurringTimeComponentDraft(ANCHOR),
      lastRecurringEventAt: date(2026, 7, 3),
    };

    expect(
      changeFirstRecurringEventAt(draft, date(2026, 6, 26)).lastRecurringEventAt?.toString(),
    ).toBe('2026-07-10');
    expect(
      changeFirstRecurringEventAt(createRecurringTimeComponentDraft(ANCHOR), date(2026, 6, 26))
        .lastRecurringEventAt,
    ).toBe(null);
  });

  it('fills a gap from the first date rather than from today', () => {
    const draft = {
      ...createRecurringTimeComponentDraft(ANCHOR),
      firstRecurringEventAt: date(2026, 9, 3),
      recurringByMonthDay: null,
      recurringByMonth: null,
    };

    expect(changeRecurringFrequency(draft, 'MONTH').recurringByMonthDay).toBe(3);
  });
});

describe('draft structure', () => {
  it('never removes the last slot', () => {
    const draft = createRecurringTimeComponentDraft(ANCHOR);
    expect(
      removeSlot(draft, draft.recurringTimeSlots[0].key)
        .recurringTimeSlots,
    ).toHaveLength(1);
  });
});
