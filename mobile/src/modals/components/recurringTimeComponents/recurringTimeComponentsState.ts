import { Temporal } from 'temporal-polyfill';
import type {
  RecurringTimeComponent,
  RecurringTimeComponentToCreate,
  SlotToCreate,
} from '../../../api/project';

export type RecurringFrequency =
  RecurringTimeComponent['recurringFrequency'];
export type Weekday = RecurringTimeComponent['recurringByDay'][number];

export type SlotDraft = SlotToCreate & { key: string };

export type RecurringTimeComponentDraft = Omit<
  RecurringTimeComponentToCreate,
  'recurringTimeSlots'
> & {
  key: string;
  kind: 'RECURRING';
  id?: string;
  projectId?: string;
  recurringTimeSlots: SlotDraft[];
};

export const WEEKDAYS: Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

export const DAY_MINUTES = 24 * 60;

export const getWeekday = (date: Temporal.PlainDate): Weekday =>
  WEEKDAYS[date.dayOfWeek - 1];

export const sortWeekdays = (days: readonly Weekday[]): Weekday[] =>
  WEEKDAYS.filter((day) => days.includes(day));

export const getRecurrenceAnchor = (): Temporal.PlainDate =>
  Temporal.Now.plainDateISO();

const runId = Math.random().toString(36).slice(2, 6);
let draftCount = 0;

export const createDraftKey = () => `draft-${runId}-${++draftCount}`;

export const createSlotDraft = (): SlotDraft => ({
  key: createDraftKey(),
  from: null,
  to: null,
  flexibleMinutesNeeded: null,
});

export const createRecurringTimeComponentDraft = (
  anchor: Temporal.PlainDate = getRecurrenceAnchor(),
): RecurringTimeComponentDraft => ({
  key: createDraftKey(),
  kind: 'RECURRING',
  recurringInterval: 1,
  recurringFrequency: 'WEEK',
  recurringByDay: [getWeekday(anchor)],
  recurringByMonthDay: anchor.day,
  recurringByMonth: anchor.month,
  firstRecurringEventAt: anchor,
  lastRecurringEventAt: null,
  recurringTimeSlots: [createSlotDraft()],
});

const fillRecurringDefaults = (
  draft: RecurringTimeComponentDraft,
  anchor: Temporal.PlainDate,
): RecurringTimeComponentDraft => ({
  ...draft,
  recurringByDay:
    draft.recurringByDay.length > 0 ? draft.recurringByDay : [getWeekday(anchor)],
  recurringByMonthDay: draft.recurringByMonthDay ?? anchor.day,
  recurringByMonth: draft.recurringByMonth ?? anchor.month,
  recurringTimeSlots:
    draft.recurringTimeSlots.length > 0
      ? draft.recurringTimeSlots
      : [createSlotDraft()],
});

export const changeRecurringFrequency = (
  draft: RecurringTimeComponentDraft,
  recurringFrequency: RecurringFrequency,
  anchor: Temporal.PlainDate = draft.firstRecurringEventAt,
): RecurringTimeComponentDraft =>
  fillRecurringDefaults({ ...draft, recurringFrequency }, anchor);

export const changeFirstRecurringEventAt = (
  draft: RecurringTimeComponentDraft,
  firstRecurringEventAt: Temporal.PlainDate,
): RecurringTimeComponentDraft => {
  const span =
    draft.lastRecurringEventAt === null
      ? null
      : draft.firstRecurringEventAt
          .until(draft.lastRecurringEventAt)
          .total({ unit: 'days' });

  return {
    ...draft,
    firstRecurringEventAt,
    lastRecurringEventAt:
      span === null
        ? draft.lastRecurringEventAt
        : firstRecurringEventAt.add({ days: Math.max(span, 0) }),
  };
};

export const getMinutesOfDay = (time: Temporal.PlainTime) =>
  time.hour * 60 + time.minute;

export const wrapsMidnight = (slot: SlotDraft): boolean =>
  slot.from !== null &&
  slot.to !== null &&
  Temporal.PlainTime.compare(slot.to, slot.from) <= 0;

export const getSlotDurationMinutes = (
  from: Temporal.PlainTime,
  to: Temporal.PlainTime,
): number =>
  (getMinutesOfDay(to) - getMinutesOfDay(from) + DAY_MINUTES) % DAY_MINUTES ||
  DAY_MINUTES;

export const changeSlotTime = (
  slot: SlotDraft,
  field: 'from' | 'to',
  time: Temporal.PlainTime,
): SlotDraft => {
  if (field === 'to') return { ...slot, to: time, flexibleMinutesNeeded: null };

  const gap =
    slot.from && slot.to ? getSlotDurationMinutes(slot.from, slot.to) : 60;

  return {
    ...slot,
    from: time,
    to: time.add({ minutes: gap }),
    flexibleMinutesNeeded: null,
  };
};

export const changeSlotToFlexible = (
  slot: SlotDraft,
  minutes: number,
): SlotDraft => ({
  ...slot,
  from: null,
  to: null,
  flexibleMinutesNeeded: minutes,
});

export const removeSlot = (
  draft: RecurringTimeComponentDraft,
  slotKey: string,
): RecurringTimeComponentDraft =>
  draft.recurringTimeSlots.length > 1
    ? {
        ...draft,
        recurringTimeSlots: draft.recurringTimeSlots.filter(
          (slot) => slot.key !== slotKey,
        ),
      }
    : draft;

export const changeSlot = (
  draft: RecurringTimeComponentDraft,
  slotKey: string,
  change: (slot: SlotDraft) => SlotDraft,
): RecurringTimeComponentDraft => ({
  ...draft,
  recurringTimeSlots: draft.recurringTimeSlots.map((slot) =>
    slot.key === slotKey ? change(slot) : slot,
  ),
});

export const isSlotValid = (slot: SlotDraft): boolean =>
  slot.flexibleMinutesNeeded !== null
    ? slot.flexibleMinutesNeeded > 0
    : slot.from !== null && slot.to !== null;

export const isRecurringTimeComponentDraftValid = (
  draft: RecurringTimeComponentDraft,
): boolean => {
  const byFrequency =
    draft.recurringFrequency === 'DAY'
      ? true
      : draft.recurringFrequency === 'WEEK'
        ? draft.recurringByDay.length > 0
        : draft.recurringFrequency === 'MONTH'
          ? draft.recurringByMonthDay !== null
          : draft.recurringByMonthDay !== null &&
            draft.recurringByMonth !== null;

  const withinBounds =
    draft.lastRecurringEventAt === null ||
    Temporal.PlainDate.compare(
      draft.firstRecurringEventAt,
      draft.lastRecurringEventAt,
    ) <= 0;

  return (
    draft.recurringInterval >= 1 &&
    withinBounds &&
    byFrequency &&
    draft.recurringTimeSlots.length > 0 &&
    draft.recurringTimeSlots.every(isSlotValid)
  );
};

export const toRecurringTimeComponentDraft = (
  component: RecurringTimeComponent,
): RecurringTimeComponentDraft => ({
  ...component,
  key: component.id,
  kind: 'RECURRING',
  recurringByDay: sortWeekdays(component.recurringByDay),
  recurringTimeSlots: component.recurringTimeSlots.map((slot) => ({
    ...slot,
    key: slot.id,
  })),
});
