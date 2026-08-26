import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import type { TimeComponentWithSlots } from '../../../api/structures/TimeComponentWithSlots';
import {
  buildReport,
  displayOrder,
  fromApiComponent,
  isDraftValid,
  isSlotValid,
  newTimeComponentDraft,
  withSlotFlex,
  withSlotRemoved,
  withSlotTime,
  withType,
} from './timeComponentsState';

const time = (hour: number, minute: number) =>
  new Temporal.PlainTime(hour, minute);

const ANCHOR = new Temporal.PlainDate(2026, 6, 19);

const absolute = (
  over: Partial<TimeComponentWithSlots> = {},
): TimeComponentWithSlots => ({
  id: 'a1',
  projectId: 'p1',
  type: 'ABSOLUTE',
  absoluteFrom: '2026-06-19T17:45:00.000Z',
  absoluteTo: '2026-06-19T18:45:00.000Z',
  recurringInterval: null,
  recurringFrequency: null,
  recurringByDay: [],
  recurringByMonthDay: null,
  recurringByMonth: null,
  recurringStartDate: null,
  recurringTimeSlots: [],
  ...over,
});

const recurring = (
  over: Partial<TimeComponentWithSlots> = {},
): TimeComponentWithSlots => ({
  id: 'r1',
  projectId: 'p1',
  type: 'RECURRING',
  absoluteFrom: null,
  absoluteTo: null,
  recurringInterval: 2,
  recurringFrequency: 'WEEK',
  recurringByDay: ['TU'],
  recurringByMonthDay: null,
  recurringByMonth: null,
  recurringStartDate: '2026-06-01T00:00:00.000Z',
  recurringTimeSlots: [
    {
      id: 's1',
      type: 'ABSOLUTE',
      from: '1970-01-01T17:45:00.000Z',
      to: '1970-01-01T18:45:00.000Z',
      flexibleMinutesNeeded: null,
      timeComponentId: 'r1',
    },
  ],
  ...over,
});

describe('fromApiComponent', () => {
  it('splits an absolute timestamp into date and time', () => {
    const draft = fromApiComponent(absolute());

    expect(draft.fromDate?.toString()).toBe('2026-06-19');
    expect(draft.fromTime?.toString({ smallestUnit: 'minute' })).toBe('17:45');
    expect(draft.toTime?.toString({ smallestUnit: 'minute' })).toBe('18:45');
  });

  it('keeps slot ids and reads times off the epoch date', () => {
    const draft = fromApiComponent(recurring());

    expect(draft.slots[0].id).toBe('s1');
    expect(draft.slots[0].from?.toString({ smallestUnit: 'minute' })).toBe(
      '17:45',
    );
    expect(draft.startDate?.toString()).toBe('2026-06-01');
  });
});

describe('buildReport', () => {
  it('is clean and valid for untouched data', () => {
    const initial = [absolute(), recurring()];
    const report = buildReport(initial.map(fromApiComponent), initial);

    expect(report.isDirty).toBe(false);
    expect(report.isValid).toBe(true);
    expect(report.changes).toEqual({
      createdTimeComponents: [],
      updatedTimeComponents: [],
      deletedTimeComponentIds: [],
    });
  });

  it('reports a removed component by id', () => {
    const initial = [absolute(), recurring()];
    const drafts = initial.map(fromApiComponent).filter((d) => d.id !== 'a1');
    const report = buildReport(drafts, initial);

    expect(report.isDirty).toBe(true);
    expect(report.changes.deletedTimeComponentIds).toEqual(['a1']);
  });

  it('reports a fresh draft as created, without ids', () => {
    const report = buildReport([newTimeComponentDraft(ANCHOR)], []);

    expect(report.changes.createdTimeComponents).toEqual([
      {
        type: 'RECURRING',
        recurringInterval: 1,
        recurringFrequency: 'WEEK',
        recurringByDay: ['FR'],
        recurringByMonthDay: undefined,
        recurringByMonth: undefined,
        recurringStartDate: '2026-06-19',
        recurringTimeSlots: [{ type: 'ABSOLUTE', from: undefined, to: undefined }],
      },
    ]);
    expect(report.isDirty).toBe(true);
    expect(report.isValid).toBe(false);
  });

  it('adding and removing again leaves the report clean', () => {
    const initial = [recurring()];
    const drafts = [...initial.map(fromApiComponent), newTimeComponentDraft(ANCHOR)];
    const report = buildReport(
      drafts.filter((draft) => draft.id !== undefined),
      initial,
    );

    expect(report.isDirty).toBe(false);
  });

  it('keeps existing slot ids on an updated component and none on a new slot', () => {
    const initial = [recurring()];
    const [draft] = initial.map(fromApiComponent);
    const edited = {
      ...draft,
      slots: [
        withSlotTime(draft.slots[0], 'from', time(9, 0)),
        { key: 'new', from: time(20, 0), to: time(21, 0), flexibleMinutesNeeded: null },
      ],
    };
    const report = buildReport([edited], initial);

    expect(report.changes.updatedTimeComponents).toHaveLength(1);
    const [updated] = report.changes.updatedTimeComponents;
    expect(updated.recurringTimeSlots[0]).toEqual({
      id: 's1',
      type: 'ABSOLUTE',
      from: '09:00',
      to: '18:45',
    });
    expect(updated.recurringTimeSlots[1].id).toBeUndefined();
  });

  it('nulls the recurring fields once a component is switched to exact time', () => {
    const initial = [recurring()];
    const [draft] = initial.map(fromApiComponent);
    const report = buildReport([withType(draft, 'ABSOLUTE')], initial);

    const [updated] = report.changes.updatedTimeComponents;
    expect(updated.type).toBe('ABSOLUTE');
    expect(updated.recurringFrequency).toBeNull();
    expect(updated.recurringTimeSlots).toEqual([]);
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
    expect(withSlotFlex(slot, 90)).toMatchObject({
      from: null,
      to: null,
      flexibleMinutesNeeded: 90,
    });
  });

  it('entering a time wipes the flexible duration', () => {
    const flexible = withSlotFlex(slot, 90);
    expect(withSlotTime(flexible, 'from', time(9, 0))).toMatchObject({
      from: time(9, 0),
      flexibleMinutesNeeded: null,
    });
  });
});

describe('validity', () => {
  it('rejects an exact range missing a field, running backwards, or empty', () => {
    const draft = fromApiComponent(absolute());

    expect(isDraftValid(draft)).toBe(true);
    expect(isDraftValid({ ...draft, toTime: null })).toBe(false);
    expect(isDraftValid({ ...draft, toDate: new Temporal.PlainDate(2026, 6, 18) })).toBe(
      false,
    );
    expect(isDraftValid({ ...draft, toTime: time(17, 45) })).toBe(false);
  });

  it('requires a slot to end after it starts', () => {
    const slot = {
      key: 's',
      from: time(10, 0),
      to: time(9, 0),
      flexibleMinutesNeeded: null,
    };

    expect(isSlotValid(slot)).toBe(false);
    expect(isSlotValid({ ...slot, to: time(10, 0) })).toBe(false);
    expect(isSlotValid({ ...slot, to: time(11, 0) })).toBe(true);
  });

  it('rejects a weekly cadence with no days and an empty slot list', () => {
    const draft = fromApiComponent(recurring());

    expect(isDraftValid({ ...draft, byDay: [] })).toBe(false);
    expect(isDraftValid({ ...draft, slots: [] })).toBe(false);
  });
});

describe('draft structure', () => {
  it('never removes the last slot', () => {
    const draft = newTimeComponentDraft(ANCHOR);
    expect(withSlotRemoved(draft, draft.slots[0].key).slots).toHaveLength(1);
  });

  it('fills recurring defaults from the anchor when switching type', () => {
    const exact = withType(newTimeComponentDraft(ANCHOR), 'ABSOLUTE');
    const back = withType({ ...exact, byDay: [], slots: [] }, 'RECURRING', ANCHOR);

    expect(back.byDay).toEqual(['FR']);
    expect(back.byMonthDay).toBe(19);
    expect(back.slots).toHaveLength(1);
  });

  it('orders recurring components before exact ones', () => {
    const drafts = [absolute(), recurring()].map(fromApiComponent);
    expect(displayOrder(drafts).map((draft) => draft.id)).toEqual(['r1', 'a1']);
  });
});
