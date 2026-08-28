import { Temporal } from 'temporal-polyfill';
import type { TimeComponentFields } from '../../../api/structures/TimeComponentFields';
import type { TimeComponentWithSlots } from '../../../api/structures/TimeComponentWithSlots';
import type { TimeSlot } from '../../../api/structures/TimeSlot';

export type TimeComponentType = 'ABSOLUTE' | 'RECURRING';
export type RecurringFrequency = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
export type Weekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';

export type SlotDraft = {
  key: string;
  id?: string;
  from: Temporal.PlainTime | null;
  to: Temporal.PlainTime | null;
  flexibleMinutesNeeded: number | null;
};

export type TimeComponentDraft = {
  key: string;
  id?: string;
  projectId?: string;
  type: TimeComponentType;
  fromDate: Temporal.PlainDate | null;
  fromTime: Temporal.PlainTime | null;
  toDate: Temporal.PlainDate | null;
  toTime: Temporal.PlainTime | null;
  interval: number;
  frequency: RecurringFrequency;
  byDay: Weekday[];
  byMonthDay: number | null;
  byMonth: number | null;
  startDate: Temporal.PlainDate | null;
  slots: SlotDraft[];
};

export type UpdatedTimeSlot = TimeSlot & { id?: string };

export type UpdatedTimeComponent = Omit<
  TimeComponentWithSlots,
  'recurringTimeSlots'
> & {
  recurringTimeSlots: UpdatedTimeSlot[];
};

export type TimeComponentsChanges = {
  createdTimeComponents: TimeComponentFields[];
  updatedTimeComponents: UpdatedTimeComponent[];
  deletedTimeComponentIds: string[];
};

export type TimeComponentsReport = {
  isDirty: boolean;
  isValid: boolean;
  changes: TimeComponentsChanges;
};

export const WEEKDAYS: Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

export const weekdayOf = (date: Temporal.PlainDate): Weekday =>
  WEEKDAYS[date.dayOfWeek - 1];

export const sortWeekdays = (days: readonly Weekday[]): Weekday[] =>
  WEEKDAYS.filter((day) => days.includes(day));

// Temporary anchor for a recurring cadence — the current day stands in until
// first/last dates are a real decision. See docs/TODO.md.
export const currentRecurrenceAnchor = (): Temporal.PlainDate =>
  Temporal.Now.plainDateISO();

// The random half keeps keys unique across module reloads: HMR resets a bare
// counter while React state survives it, and a later draft would collide with
// one made before the reload.
const runId = Math.random().toString(36).slice(2, 6);
let draftCount = 0;
const newKey = () => `draft-${runId}-${++draftCount}`;

export const newSlotDraft = (): SlotDraft => ({
  key: newKey(),
  from: null,
  to: null,
  flexibleMinutesNeeded: null,
});

export const newTimeComponentDraft = (
  anchor: Temporal.PlainDate = currentRecurrenceAnchor(),
): TimeComponentDraft => ({
  key: newKey(),
  type: 'RECURRING',
  fromDate: null,
  fromTime: null,
  toDate: null,
  toTime: null,
  interval: 1,
  frequency: 'WEEK',
  byDay: [weekdayOf(anchor)],
  byMonthDay: anchor.day,
  byMonth: anchor.month,
  startDate: anchor,
  slots: [newSlotDraft()],
});

const withRecurringDefaults = (
  draft: TimeComponentDraft,
  anchor: Temporal.PlainDate,
): TimeComponentDraft => ({
  ...draft,
  byDay: draft.byDay.length > 0 ? draft.byDay : [weekdayOf(anchor)],
  byMonthDay: draft.byMonthDay ?? anchor.day,
  byMonth: draft.byMonth ?? anchor.month,
  startDate: draft.startDate ?? anchor,
  slots: draft.slots.length > 0 ? draft.slots : [newSlotDraft()],
});

export const withType = (
  draft: TimeComponentDraft,
  type: TimeComponentType,
  anchor: Temporal.PlainDate = currentRecurrenceAnchor(),
): TimeComponentDraft =>
  type === draft.type
    ? draft
    : type === 'ABSOLUTE'
      ? { ...draft, type }
      : withRecurringDefaults({ ...draft, type }, anchor);

export const withFrequency = (
  draft: TimeComponentDraft,
  frequency: RecurringFrequency,
  anchor: Temporal.PlainDate = currentRecurrenceAnchor(),
): TimeComponentDraft => withRecurringDefaults({ ...draft, frequency }, anchor);

const DAY_MINUTES = 24 * 60;

const minutesOf = (time: Temporal.PlainTime) => time.hour * 60 + time.minute;

const laterBy = (
  time: Temporal.PlainTime,
  minutes: number,
): Temporal.PlainTime => {
  const later = time.add({ minutes });
  // Wrapped past midnight — a slot stays within its day, so stop at the top
  // of the grid instead.
  return Temporal.PlainTime.compare(later, time) > 0
    ? later
    : new Temporal.PlainTime(23, 55);
};

// The exact-range twin of the slot rule below: moving From moves the whole
// range, keeping its duration — dates included, so an end may roll past
// midnight, which an exact range (unlike a slot) is allowed to do. Editing To
// is what changes the length.
export const withExactFrom = (
  draft: TimeComponentDraft,
  fromDate: Temporal.PlainDate | null,
  fromTime: Temporal.PlainTime | null,
): TimeComponentDraft => {
  const moved = { ...draft, fromDate, fromTime };

  if (fromDate && fromTime) {
    const start = fromDate.toPlainDateTime(fromTime);
    const gap =
      draft.fromDate && draft.fromTime && draft.toDate && draft.toTime
        ? draft.fromDate
            .toPlainDateTime(draft.fromTime)
            .until(draft.toDate.toPlainDateTime(draft.toTime))
            .total({ unit: 'minutes' })
        : 0;
    const end = start.add({ minutes: gap > 0 ? gap : 60 });
    return { ...moved, toDate: end.toPlainDate(), toTime: end.toPlainTime() };
  }

  if (fromDate) {
    const dayGap =
      draft.fromDate && draft.toDate
        ? draft.fromDate.until(draft.toDate).total({ unit: 'days' })
        : 0;
    return { ...moved, toDate: fromDate.add({ days: Math.max(dayGap, 0) }) };
  }

  if (fromTime) {
    const gap =
      draft.fromTime &&
      draft.toTime &&
      Temporal.PlainTime.compare(draft.toTime, draft.fromTime) > 0
        ? minutesOf(draft.toTime) - minutesOf(draft.fromTime)
        : 60;
    return { ...moved, toTime: laterBy(fromTime, gap) };
  }

  return moved;
};

/* A slot whose end clock-time is at or before its start ends the next day.
   Equal times are the far edge of that reading: exactly 24 hours, the longest
   a slot can be. */
export const slotWrapsMidnight = (slot: SlotDraft): boolean =>
  slot.from !== null &&
  slot.to !== null &&
  Temporal.PlainTime.compare(slot.to, slot.from) <= 0;

export const slotDurationMinutes = (
  from: Temporal.PlainTime,
  to: Temporal.PlainTime,
): number =>
  (minutesOf(to) - minutesOf(from) + DAY_MINUTES) % DAY_MINUTES || DAY_MINUTES;

export const withSlotTime = (
  slot: SlotDraft,
  field: 'from' | 'to',
  time: Temporal.PlainTime,
): SlotDraft => {
  if (field === 'to') return { ...slot, to: time, flexibleMinutesNeeded: null };

  // The end travels with the start, keeping whatever duration the slot
  // currently has (an hour when there is none yet) — moving a start is moving
  // the slot, not stretching it. Editing the end is what changes the length.
  // The gap is wrap-aware: an overnight slot keeps its overnight length, and
  // a full-day slot (equal ends) stays a full day.
  const gap =
    slot.from && slot.to ? slotDurationMinutes(slot.from, slot.to) : 60;

  return {
    ...slot,
    from: time,
    to: time.add({ minutes: gap }),
    flexibleMinutesNeeded: null,
  };
};

export const withSlotFlex = (slot: SlotDraft, minutes: number): SlotDraft => ({
  ...slot,
  from: null,
  to: null,
  flexibleMinutesNeeded: minutes,
});

export const withSlotRemoved = (
  draft: TimeComponentDraft,
  slotKey: string,
): TimeComponentDraft =>
  draft.slots.length > 1
    ? { ...draft, slots: draft.slots.filter((slot) => slot.key !== slotKey) }
    : draft;

export const withSlotChanged = (
  draft: TimeComponentDraft,
  slotKey: string,
  change: (slot: SlotDraft) => SlotDraft,
): TimeComponentDraft => ({
  ...draft,
  slots: draft.slots.map((slot) =>
    slot.key === slotKey ? change(slot) : slot,
  ),
});

export const isSlotValid = (slot: SlotDraft): boolean =>
  slot.flexibleMinutesNeeded !== null
    ? slot.flexibleMinutesNeeded > 0
    : slot.from !== null && slot.to !== null;

export const isDraftValid = (draft: TimeComponentDraft): boolean => {
  if (draft.type === 'ABSOLUTE') {
    return (
      draft.fromDate !== null &&
      draft.fromTime !== null &&
      draft.toDate !== null &&
      draft.toTime !== null &&
      Temporal.PlainDateTime.compare(
        draft.fromDate.toPlainDateTime(draft.fromTime),
        draft.toDate.toPlainDateTime(draft.toTime),
      ) < 0
    );
  }

  const byFrequency =
    draft.frequency === 'DAY'
      ? true
      : draft.frequency === 'WEEK'
        ? draft.byDay.length > 0
        : draft.frequency === 'MONTH'
          ? draft.byMonthDay !== null
          : draft.byMonthDay !== null && draft.byMonth !== null;

  return (
    draft.interval >= 1 &&
    byFrequency &&
    draft.slots.length > 0 &&
    draft.slots.every(isSlotValid)
  );
};

export const displayOrder = (
  drafts: readonly TimeComponentDraft[],
): TimeComponentDraft[] => [
  ...drafts.filter((draft) => draft.type === 'RECURRING'),
  ...drafts.filter((draft) => draft.type === 'ABSOLUTE'),
];

const withoutZone = (value: string) => value.replace(/(\.\d+)?Z?$/i, '');

const parseDateTime = (value: string) =>
  Temporal.PlainDateTime.from(withoutZone(value));

export const fromApiComponent = (
  source: TimeComponentWithSlots,
): TimeComponentDraft => {
  const from = source.absoluteFrom ? parseDateTime(source.absoluteFrom) : null;
  const to = source.absoluteTo ? parseDateTime(source.absoluteTo) : null;

  return {
    key: source.id,
    id: source.id,
    projectId: source.projectId,
    type: source.type,
    fromDate: from?.toPlainDate() ?? null,
    fromTime: from?.toPlainTime() ?? null,
    toDate: to?.toPlainDate() ?? null,
    toTime: to?.toPlainTime() ?? null,
    interval: source.recurringInterval ?? 1,
    frequency: source.recurringFrequency ?? 'WEEK',
    byDay: sortWeekdays(source.recurringByDay),
    byMonthDay: source.recurringByMonthDay,
    byMonth: source.recurringByMonth,
    startDate: source.recurringStartDate
      ? parseDateTime(source.recurringStartDate).toPlainDate()
      : null,
    slots: source.recurringTimeSlots.map((slot) => ({
      key: slot.id,
      id: slot.id,
      from: slot.from ? parseDateTime(slot.from).toPlainTime() : null,
      to: slot.to ? parseDateTime(slot.to).toPlainTime() : null,
      flexibleMinutesNeeded: slot.flexibleMinutesNeeded,
    })),
  };
};

const serializeTime = (time: Temporal.PlainTime) =>
  time.toString({ smallestUnit: 'minute' });

const serializeDateTime = (
  date: Temporal.PlainDate,
  time: Temporal.PlainTime,
) => date.toPlainDateTime(time).toString({ smallestUnit: 'minute' });

const toTimeSlot = (slot: SlotDraft): TimeSlot =>
  slot.flexibleMinutesNeeded !== null
    ? { type: 'FLEXIBLE', flexibleMinutesNeeded: slot.flexibleMinutesNeeded }
    : {
        type: 'ABSOLUTE',
        from: slot.from ? serializeTime(slot.from) : undefined,
        to: slot.to ? serializeTime(slot.to) : undefined,
      };

export const toCreated = (draft: TimeComponentDraft): TimeComponentFields =>
  draft.type === 'ABSOLUTE'
    ? {
        type: 'ABSOLUTE',
        absoluteFrom:
          draft.fromDate && draft.fromTime
            ? serializeDateTime(draft.fromDate, draft.fromTime)
            : undefined,
        absoluteTo:
          draft.toDate && draft.toTime
            ? serializeDateTime(draft.toDate, draft.toTime)
            : undefined,
      }
    : {
        type: 'RECURRING',
        recurringInterval: draft.interval,
        recurringFrequency: draft.frequency,
        recurringByDay:
          draft.frequency === 'WEEK' ? sortWeekdays(draft.byDay) : undefined,
        recurringByMonthDay:
          draft.frequency === 'MONTH' || draft.frequency === 'YEAR'
            ? (draft.byMonthDay ?? undefined)
            : undefined,
        recurringByMonth:
          draft.frequency === 'YEAR' ? (draft.byMonth ?? undefined) : undefined,
        recurringStartDate: draft.startDate?.toString(),
        recurringTimeSlots: draft.slots.map(toTimeSlot),
      };

type PersistedDraft = TimeComponentDraft & { id: string; projectId: string };

const isPersisted = (draft: TimeComponentDraft): draft is PersistedDraft =>
  draft.id !== undefined && draft.projectId !== undefined;

export const toUpdated = (draft: PersistedDraft): UpdatedTimeComponent => {
  const recurring = draft.type === 'RECURRING';

  return {
    id: draft.id,
    projectId: draft.projectId,
    type: draft.type,
    absoluteFrom:
      !recurring && draft.fromDate && draft.fromTime
        ? serializeDateTime(draft.fromDate, draft.fromTime)
        : null,
    absoluteTo:
      !recurring && draft.toDate && draft.toTime
        ? serializeDateTime(draft.toDate, draft.toTime)
        : null,
    recurringInterval: recurring ? draft.interval : null,
    recurringFrequency: recurring ? draft.frequency : null,
    recurringByDay:
      recurring && draft.frequency === 'WEEK' ? sortWeekdays(draft.byDay) : [],
    recurringByMonthDay:
      recurring && (draft.frequency === 'MONTH' || draft.frequency === 'YEAR')
        ? draft.byMonthDay
        : null,
    recurringByMonth:
      recurring && draft.frequency === 'YEAR' ? draft.byMonth : null,
    recurringStartDate: recurring
      ? (draft.startDate?.toString() ?? null)
      : null,
    recurringTimeSlots: recurring
      ? draft.slots.map((slot) => ({ ...toTimeSlot(slot), id: slot.id }))
      : [],
  };
};

export const buildReport = (
  drafts: readonly TimeComponentDraft[],
  initial: readonly TimeComponentWithSlots[],
): TimeComponentsReport => {
  const baseline = new Map(
    initial
      .map(fromApiComponent)
      .filter(isPersisted)
      .map((draft): [string, string] => [
        draft.id,
        JSON.stringify(toUpdated(draft)),
      ]),
  );

  const persisted = drafts.filter(isPersisted);
  const createdTimeComponents = drafts
    .filter((draft) => draft.id === undefined)
    .map(toCreated);
  const updatedTimeComponents = persisted
    .map(toUpdated)
    .filter((updated) => JSON.stringify(updated) !== baseline.get(updated.id));
  const kept = new Set(persisted.map((draft) => draft.id));
  const deletedTimeComponentIds = [...baseline.keys()].filter(
    (id) => !kept.has(id),
  );

  return {
    isDirty:
      createdTimeComponents.length > 0 ||
      updatedTimeComponents.length > 0 ||
      deletedTimeComponentIds.length > 0,
    isValid: drafts.every(isDraftValid),
    changes: {
      createdTimeComponents,
      updatedTimeComponents,
      deletedTimeComponentIds,
    },
  };
};
