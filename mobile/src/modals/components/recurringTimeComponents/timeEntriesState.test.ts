import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import {
  toRecurringTimeComponentDraft,
  createRecurringTimeComponentDraft,
  changeSlotTime,
} from './recurringTimeComponentsState';
import { toEventDraft, createEventDraft, changeEventStart } from './eventState';
import {
  buildTimeEntriesReport,
  sortEntriesForDisplay,
  isEntryBlank,
  changeEntryKind,
} from './timeEntriesState';
import { recurring } from './recurringTimeComponentsState.test';
import { event } from './eventState.test';

const time = (hour: number, minute: number) =>
  new Temporal.PlainTime(hour, minute);

const date = (year: number, month: number, day: number) =>
  new Temporal.PlainDate(year, month, day);

const ANCHOR = new Temporal.PlainDate(2026, 6, 19);

describe('buildTimeEntriesReport', () => {
  it('is clean and valid for untouched data', () => {
    const components = [
      recurring({ lastRecurringEventAt: new Temporal.PlainDate(2026, 7, 1) }),
    ];
    const events = [event()];
    const report = buildTimeEntriesReport(
      [...components.map(toRecurringTimeComponentDraft), ...events.map(toEventDraft)],
      components,
      events,
    );

    expect(report.isDirty).toBe(false);
    expect(report.isValid).toBe(true);
    expect(report.changes).toEqual({
      createdRecurringTimeComponents: [],
      updatedRecurringTimeComponents: [],
      deletedRecurringTimeComponentIds: [],
      createdEvents: [],
      updatedEvents: [],
      deletedEventIds: [],
    });
  });

  it('ignores an offered-but-untouched blank entry', () => {
    const blank = createEventDraft();
    const report = buildTimeEntriesReport([blank], [], []);

    expect(isEntryBlank(blank)).toBe(true);
    expect(report.isDirty).toBe(false);
    expect(report.changes.createdEvents).toEqual([]);
  });

  it('counts the same entry once anything is entered', () => {
    const touched = changeEventStart(createEventDraft(), date(2026, 6, 19), null);
    const report = buildTimeEntriesReport([touched], [], []);

    expect(isEntryBlank(touched)).toBe(false);
    expect(report.isDirty).toBe(true);
    expect(report.changes.createdEvents).toHaveLength(1);
  });

  it('never treats a persisted entry as blank', () => {
    const saved = toEventDraft(event());

    expect(
      isEntryBlank({
        ...saved,
        fromDate: null,
        fromTime: null,
        toDate: null,
        toTime: null,
      }),
    ).toBe(false);
  });

  it('reports a removed entry by id, in its own list', () => {
    const components = [recurring()];
    const events = [event()];
    const report = buildTimeEntriesReport(
      components.map(toRecurringTimeComponentDraft),
      components,
      events,
    );

    expect(report.isDirty).toBe(true);
    expect(report.changes.deletedEventIds).toEqual(['a1']);
    expect(report.changes.deletedRecurringTimeComponentIds).toEqual([]);
  });

  it('keeps existing slot ids on an updated component and none on a new slot', () => {
    const components = [recurring()];
    const [draft] = components.map(toRecurringTimeComponentDraft);
    const edited = {
      ...draft,
      recurringTimeSlots: [
        changeSlotTime(draft.recurringTimeSlots[0], 'from', time(9, 0)),
        {
          key: 'new',
          from: time(20, 0),
          to: time(21, 0),
          flexibleMinutesNeeded: null,
        },
      ],
    };
    const report = buildTimeEntriesReport([edited], components, []);

    expect(report.changes.updatedRecurringTimeComponents).toHaveLength(1);
    const [updated] = report.changes.updatedRecurringTimeComponents;
    const recurringTimeSlots = updated.recurringTimeSlots ?? [];
    expect(recurringTimeSlots[0]).toMatchObject({
      id: 's1',
      from: time(9, 0),
      to: time(10, 0),
      flexibleMinutesNeeded: null,
    });
    expect(recurringTimeSlots[1].id).toBeUndefined();
  });

  it('deletes the component when a saved recurring entry is toggled', () => {
    const components = [recurring()];
    const [draft] = components.map(toRecurringTimeComponentDraft);
    const report = buildTimeEntriesReport([changeEntryKind(draft, 'ABSOLUTE')], components, []);

    expect(report.changes.deletedRecurringTimeComponentIds).toEqual(['r1']);
    expect(report.changes.createdEvents).toEqual([]);
    expect(report.changes.updatedRecurringTimeComponents).toEqual([]);
  });

  it('creates the event once the toggled entry has times', () => {
    const components = [recurring()];
    const [draft] = components.map(toRecurringTimeComponentDraft);
    const toggled = changeEntryKind(draft, 'ABSOLUTE');
    if (toggled.kind !== 'ABSOLUTE') throw new Error('expected an exact entry');

    const filled = changeEventStart(toggled, date(2026, 6, 19), time(9, 0));
    const report = buildTimeEntriesReport([filled], components, []);

    expect(report.changes.deletedRecurringTimeComponentIds).toEqual(['r1']);
    expect(report.changes.createdEvents).toEqual([
      {
        start: date(2026, 6, 19).toPlainDateTime(time(9, 0)),
        end: date(2026, 6, 19).toPlainDateTime(time(10, 0)),
      },
    ]);
  });

  it('moves a saved event into the components list when toggled', () => {
    const events = [event()];
    const [draft] = events.map(toEventDraft);
    const report = buildTimeEntriesReport([changeEntryKind(draft, 'RECURRING')], [], events);

    expect(report.changes.deletedEventIds).toEqual(['a1']);
    expect(report.changes.createdRecurringTimeComponents).toHaveLength(1);
    expect(report.changes.updatedEvents).toEqual([]);
  });

  it('never puts an id from one kind into the other kind list', () => {
    const components = [recurring()];
    const events = [event()];
    const report = buildTimeEntriesReport([], components, events);

    expect(report.changes.deletedRecurringTimeComponentIds).toEqual(['r1']);
    expect(report.changes.deletedEventIds).toEqual(['a1']);
  });
});

describe('changeEntryKind', () => {
  it('keeps the entry in place and drops the id it can no longer use', () => {
    const draft = toRecurringTimeComponentDraft(recurring());
    const toggled = changeEntryKind(draft, 'ABSOLUTE');

    expect(toggled.key).toBe(draft.key);
    expect(toggled.id).toBeUndefined();
    expect(toggled.kind).toBe('ABSOLUTE');
  });

  it('fills recurring defaults from the anchor when switching back', () => {
    const back = changeEntryKind(createEventDraft(), 'RECURRING', ANCHOR);

    expect(back.kind).toBe('RECURRING');
    if (back.kind !== 'RECURRING') return;
    expect(back.recurringByDay).toEqual(['FR']);
    expect(back.recurringByMonthDay).toBe(19);
    expect(back.firstRecurringEventAt).toEqual(ANCHOR);
    expect(back.lastRecurringEventAt).toBe(null);
    expect(back.recurringTimeSlots).toHaveLength(1);
  });

  it('anchors a new cadence on the exact entry it came from', () => {
    const exact = changeEventStart(createEventDraft(), date(2026, 9, 3), null);
    const back = changeEntryKind(exact, 'RECURRING');

    expect(
      back.kind === 'RECURRING' && back.firstRecurringEventAt?.toString(),
    ).toBe('2026-09-03');
  });
});

describe('sortEntriesForDisplay', () => {
  it('orders recurring entries before exact ones', () => {
    const entries = [toEventDraft(event()), toRecurringTimeComponentDraft(recurring())];

    expect(sortEntriesForDisplay(entries).map((entry) => entry.id)).toEqual([
      'r1',
      'a1',
    ]);
  });
});

describe('draft factories', () => {
  it('opens a new entry recurring and a seeded one exact', () => {
    expect(createRecurringTimeComponentDraft(ANCHOR).kind).toBe('RECURRING');
    expect(createEventDraft().kind).toBe('ABSOLUTE');
  });
});
