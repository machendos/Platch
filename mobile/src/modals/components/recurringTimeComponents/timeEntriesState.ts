import { Temporal } from 'temporal-polyfill';
import type { Event } from '../../../api/event';
import type {
  ProjectChanges,
  RecurringTimeComponent,
} from '../../../api/project';
import {
  createRecurringTimeComponentDraft,
  getRecurrenceAnchor,
  isRecurringTimeComponentDraftValid,
  toRecurringTimeComponentDraft,
} from './recurringTimeComponentsState';
import type { RecurringTimeComponentDraft } from './recurringTimeComponentsState';
import {
  createEventDraft,
  isEventDraftValid,
  toEvent,
  toEventDraft,
} from './eventState';
import type { EventDraft } from './eventState';

export type EntryKind = 'ABSOLUTE' | 'RECURRING';

export type TimeEntryDraft = EventDraft | RecurringTimeComponentDraft;

export type TimeEntriesReport = {
  isDirty: boolean;
  isValid: boolean;
  changes: ProjectChanges;
};

const getEntryAnchor = (entry: TimeEntryDraft): Temporal.PlainDate =>
  entry.kind === 'RECURRING'
    ? (entry.firstRecurringEventAt ?? getRecurrenceAnchor())
    : (entry.fromDate ?? getRecurrenceAnchor());

export const changeEntryKind = (
  entry: TimeEntryDraft,
  kind: EntryKind,
  anchor: Temporal.PlainDate = getEntryAnchor(entry),
): TimeEntryDraft => {
  if (kind === entry.kind) return entry;

  return kind === 'ABSOLUTE'
    ? { ...createEventDraft(), key: entry.key }
    : { ...createRecurringTimeComponentDraft(anchor), key: entry.key };
};

export const isEntryBlank = (entry: TimeEntryDraft): boolean =>
  entry.kind === 'ABSOLUTE' &&
  entry.id === undefined &&
  entry.fromDate === null &&
  entry.fromTime === null &&
  entry.toDate === null &&
  entry.toTime === null;

export const isEntryValid = (entry: TimeEntryDraft): boolean =>
  entry.kind === 'RECURRING'
    ? isRecurringTimeComponentDraftValid(entry)
    : isEventDraftValid(entry);

export const sortEntriesForDisplay = (
  entries: readonly TimeEntryDraft[],
): TimeEntryDraft[] => [
  ...entries.filter((entry) => entry.kind === 'RECURRING'),
  ...entries.filter((entry) => entry.kind === 'ABSOLUTE'),
];

const getPersistedId = (entry: TimeEntryDraft): string | undefined =>
  entry.id !== undefined && entry.projectId !== undefined
    ? entry.id
    : undefined;

const asBaseline = <T>(values: readonly { id: string; value: T }[]) =>
  new Map(values.map(({ id, value }) => [id, JSON.stringify(value)]));

export const buildTimeEntriesReport = (
  entries: readonly TimeEntryDraft[],
  initialRecurringTimeComponents: readonly RecurringTimeComponent[],
  initialEvents: readonly Event[],
): TimeEntriesReport => {
  const componentBaseline = asBaseline(
    initialRecurringTimeComponents.map((component) => ({
      id: component.id,
      value: toRecurringTimeComponentDraft(component),
    })),
  );

  const eventBaseline = asBaseline(
    initialEvents.map((event) => ({
      id: event.id,
      value: toEventDraft(event),
    })),
  );

  const filled = entries.filter((entry) => !isEntryBlank(entry));

  const componentDrafts = filled.filter(
    (entry): entry is RecurringTimeComponentDraft => entry.kind === 'RECURRING',
  );
  const eventDrafts = filled.filter(
    (entry): entry is EventDraft => entry.kind === 'ABSOLUTE',
  );

  const createdRecurringTimeComponents = componentDrafts.filter(
    (draft) => getPersistedId(draft) === undefined,
  );

  const updatedRecurringTimeComponents = componentDrafts.flatMap((draft) => {
    const id = getPersistedId(draft);

    return id === undefined ||
      JSON.stringify(draft) === componentBaseline.get(id)
      ? []
      : [{ ...draft, id }];
  });

  const keptComponentIds = new Set(componentDrafts.map(getPersistedId));
  const deletedRecurringTimeComponentIds = [...componentBaseline.keys()].filter(
    (id) => !keptComponentIds.has(id),
  );

  const createdEvents = eventDrafts
    .filter((draft) => getPersistedId(draft) === undefined)
    .map(toEvent);

  const updatedEvents = eventDrafts.flatMap((draft) => {
    const id = getPersistedId(draft);

    return id === undefined || JSON.stringify(draft) === eventBaseline.get(id)
      ? []
      : [{ ...toEvent(draft), id }];
  });

  const keptEventIds = new Set(eventDrafts.map(getPersistedId));
  const deletedEventIds = [...eventBaseline.keys()].filter(
    (id) => !keptEventIds.has(id),
  );

  const changes: ProjectChanges = {
    createdRecurringTimeComponents,
    updatedRecurringTimeComponents,
    deletedRecurringTimeComponentIds,
    createdEvents,
    updatedEvents,
    deletedEventIds,
  };

  return {
    isDirty: Object.values(changes).some((list) => list.length > 0),
    isValid: filled.every(isEntryValid),
    changes,
  };
};
