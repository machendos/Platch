import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onlineManager } from '@tanstack/react-query';

let serverCalls = 0;
let serverFails = false;
let serverHangs = false;

vi.mock('../../../system/device-storage/deviceStorage', () => ({
  deviceStorage: {
    get: async () => null,
    set: async () => undefined,
    remove: async () => undefined,
  },
}));

vi.mock('../../../system/api.client', () => ({
  getConnection: () => ({}),
  isAuthenticated: async () => true,
  apiClient: {
    timezone_change: {
      createTimezoneChange: async () => ({}),
      getUserTimezoneChanges: async () => {
        serverCalls += 1;
        if (serverHangs) return new Promise(() => {});
        if (serverFails) throw new Error('offline');

        return [
          { ianaTimezone: 'Asia/Tokyo', changesAt: '2026-09-14T12:00:00Z' },
        ];
      },
    },
  },
}));

const { timezoneChanges } = await import('./timezoneChanges');
const { SERVER_CHANGES_QUERY_KEY } = await import('./timezone.changes.queue');
const { queryClient } = await import('../../../api/query.client');

const CACHED = [
  { ianaTimezone: 'America/Los_Angeles', changesAt: '2026-09-01T12:00:00Z' },
];

const zonesFrom = async () =>
  (await timezoneChanges.getHistory()).map((change) => change.ianaTimezone);

describe('reading the timeline', () => {
  beforeEach(() => {
    serverCalls = 0;
    serverFails = false;
    serverHangs = false;
    queryClient.clear();
    onlineManager.setOnline(true);
  });

  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('asks the server when it can', async () => {
    expect(await zonesFrom()).toEqual(['Asia/Tokyo']);
    expect(serverCalls).toBe(1);
  });

  /* Offline the request is attempted and fails, rather than being held until
     the network returns. Waiting for a connection would leave the zone watch
     unable to decide anything at the one moment it is running. */
  it('does not wait for the network, and answers from the cache', async () => {
    onlineManager.setOnline(false);
    serverFails = true;
    queryClient.setQueryData(SERVER_CHANGES_QUERY_KEY, CACHED);

    expect(await zonesFrom()).toEqual(['America/Los_Angeles']);
    expect(serverCalls).toBe(1);
  });

  it('answers with an empty timeline when nothing is cached either', async () => {
    serverFails = true;

    expect(await timezoneChanges.getHistory()).toEqual([]);
  });

  /* A server that accepts the connection and never answers. Being offline is
     not the dangerous case — that fails at once. This one would otherwise hold
     the caller for the browser's TCP timeout, and the zone watch drops every
     later check while one is still running. */
  it('gives up on a server that never answers', async () => {
    vi.useFakeTimers();
    serverHangs = true;
    queryClient.setQueryData(SERVER_CHANGES_QUERY_KEY, CACHED);

    const read = timezoneChanges.getHistory();
    await vi.advanceTimersByTimeAsync(3000);

    expect((await read).map((change) => change.ianaTimezone)).toEqual([
      'America/Los_Angeles',
    ]);

    vi.useRealTimers();
  });
});
