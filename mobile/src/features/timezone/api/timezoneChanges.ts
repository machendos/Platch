/* Where the device has been: read it, or record a change to it.
 *
 * Whether a change is still on the device or already stored is decided here,
 * not by callers. See docs/timezone.md.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Temporal } from 'temporal-polyfill';
import { apiClient, getConnection } from '../../../system/api.client';
import { queryClient } from '../../../api/query.client';
import type { CreateTimezoneChangeDto } from '../../../api/sdk/structures/CreateTimezoneChangeDto';
import {
  SERVER_CHANGES_QUERY_KEY,
  holdChangeOnDevice,
  readUnsentChanges,
  sendUnsentChanges,
  unsentChangesAsTimeline,
  useUnsentChanges,
} from './timezone.changes.queue';

export type TimezoneChange = {
  ianaTimezone: string;
  changesAt: Temporal.Instant;
  cityLabel?: string | null;
};

type ServerChangeRow = { ianaTimezone: string; changesAt: string };

const mapChanges = (rows: readonly ServerChangeRow[]) =>
  rows.map((row) => ({
    ...row,
    changesAt: Temporal.Instant.from(row.changesAt),
  }));

const sortedByChangeInstant = (changes: TimezoneChange[]) =>
  [...changes].sort((a, b) =>
    Temporal.Instant.compare(a.changesAt, b.changesAt),
  );

const serverChangesQuery = {
  queryKey: SERVER_CHANGES_QUERY_KEY,
  queryFn: () =>
    apiClient.timezone_change.getUserTimezoneChanges(getConnection()),
  select: mapChanges,
  /* Fails offline rather than waiting for a connection, so the caller falls
     back to the cache instead of hanging. */
  networkMode: 'always' as const,
  retry: false,
};

const cachedServerChanges = () =>
  mapChanges(
    queryClient.getQueryData<ServerChangeRow[]>(SERVER_CHANGES_QUERY_KEY) ?? [],
  );

/* How long a read waits for the server before answering from the cache.
   `networkMode: 'always'` covers being offline — the request fails at once —
   but not a server that accepts the connection and never answers, which would
   otherwise block the caller for the browser's TCP timeout. */
const SERVER_READ_TIMEOUT_MS = 3000;

const serverChangesOrCache = () =>
  Promise.race([
    queryClient
      .query({ ...serverChangesQuery, staleTime: 0 })
      .catch(cachedServerChanges),
    new Promise<TimezoneChange[]>((resolve) =>
      setTimeout(() => resolve(cachedServerChanges()), SERVER_READ_TIMEOUT_MS),
    ),
  ]);

const newUnsentChangeId = () =>
  crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random()}`;

export const timezoneChanges = {
  async getHistory(): Promise<TimezoneChange[]> {
    void sendUnsentChanges();

    const [fromServer, unsent] = await Promise.all([
      serverChangesOrCache(),
      readUnsentChanges(),
    ]);

    return sortedByChangeInstant([
      ...fromServer,
      ...unsentChangesAsTimeline(unsent),
    ]);
  },

  async create(change: CreateTimezoneChangeDto): Promise<void> {
    await holdChangeOnDevice({ ...change, unsentId: newUnsentChangeId() });
  },
};

/** The same history, for rendering. Re-renders as either source changes. */
export const useTimezoneHistory = (): TimezoneChange[] => {
  const fromServer = useQuery(serverChangesQuery).data;
  const unsent = useUnsentChanges();

  return useMemo(
    () =>
      sortedByChangeInstant([
        ...(fromServer ?? []),
        ...unsentChangesAsTimeline(unsent),
      ]),
    [fromServer, unsent],
  );
};
