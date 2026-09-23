import { useQuery } from '@tanstack/react-query';
import { Temporal } from 'temporal-polyfill';
import type { getEventsInRange } from './sdk/functional/event';
import { apiClient, getConnection } from '../system/api.client';
import { queryClient } from './query.client';
import {
  fromApiStringToPlainDateTime,
  fromPlainDateToApiDate,
} from '../system/helpers/dateConversions';

type EventFromApi = getEventsInRange.Output[number];

export type Event = Omit<EventFromApi, 'start' | 'end'> & {
  start: Temporal.PlainDateTime | null;
  end: Temporal.PlainDateTime | null;
};

export const EVENTS_KEY = ['events'] as const;

const toEvents = (rows: EventFromApi[]): Event[] =>
  rows.map((row) => ({
    ...row,
    start: row.start ? fromApiStringToPlainDateTime(row.start) : null,
    end: row.end ? fromApiStringToPlainDateTime(row.end) : null,
  }));

const eventsInRangeKey = (from: Temporal.PlainDate, to: Temporal.PlainDate) =>
  [
    ...EVENTS_KEY,
    'range',
    fromPlainDateToApiDate(from),
    fromPlainDateToApiDate(to),
  ] as const;

const eventsOfProjectKey = (projectId: string) =>
  [...EVENTS_KEY, 'project', projectId] as const;

const eventsInRangeQuery = (
  from: Temporal.PlainDate,
  to: Temporal.PlainDate,
) => ({
  queryKey: eventsInRangeKey(from, to),
  queryFn: () =>
    apiClient.event.getEventsInRange(getConnection(), {
      from: fromPlainDateToApiDate(from),
      to: fromPlainDateToApiDate(to),
    }),
  select: toEvents,
});

const eventsOfProjectQuery = (projectId: string) => ({
  queryKey: eventsOfProjectKey(projectId),
  queryFn: () =>
    apiClient.event.by_project.getEventsOfProject(getConnection(), {
      projectId,
    }),
  select: toEvents,
});

export const events = {
  getEventsInRange: (
    from: Temporal.PlainDate,
    to: Temporal.PlainDate,
  ): Promise<Event[]> =>
    queryClient.query({ ...eventsInRangeQuery(from, to), staleTime: 0 }),

  getEventsOfProject: (projectId: string): Promise<Event[]> =>
    queryClient.query({ ...eventsOfProjectQuery(projectId), staleTime: 0 }),
};

export const useEventsInRangeHotReload = (
  from: Temporal.PlainDate,
  to: Temporal.PlainDate,
): Event[] => useQuery(eventsInRangeQuery(from, to)).data ?? [];
