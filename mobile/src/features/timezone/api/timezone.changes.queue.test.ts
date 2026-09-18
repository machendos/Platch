import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, unknown>();
const created: unknown[] = [];
let serverFails = false;

vi.mock('../../../system/device-storage/deviceStorage', () => ({
  deviceStorage: {
    get: async (key: string) => storage.get(key) ?? null,
    set: async (key: string, value: unknown) => void storage.set(key, value),
    remove: async (key: string) => void storage.delete(key),
  },
}));

vi.mock('../../../system/api.client', () => ({
  getConnection: () => ({}),
  apiClient: {
    timezone_change: {
      createTimezoneChange: async (_c: unknown, dto: unknown) => {
        if (serverFails) throw new Error('offline');
        created.push(dto);
        return dto;
      },
    },
  },
}));

/* The outbox keeps its list in module scope, so each test gets its own copy of
   the module rather than inheriting the previous test's changes. */
const freshOutbox = async () => {
  vi.resetModules();

  return import('./timezone.changes.queue');
};

const change = (zone: string, at: string) => ({
  unsentId: `${zone}-${at}`,
  ianaTimezone: zone,
  changesAt: at,
  deviceId: 'device-1',
});

const onDevice = () =>
  (storage.get('timezone-change-queue') ?? []) as { ianaTimezone: string }[];

describe('the outbox', () => {
  beforeEach(() => {
    storage.clear();
    created.length = 0;
    serverFails = false;
    // Several tests fail sends on purpose; the outbox reports those.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps a change it could not send', async () => {
    const { holdChangeOnDevice, sendUnsentChanges } = await freshOutbox();
    serverFails = true;

    await holdChangeOnDevice(
      change('America/New_York', '2026-09-14T15:00:00Z'),
    );
    await sendUnsentChanges();

    expect(created).toHaveLength(0);
    expect(onDevice().map((c) => c.ianaTimezone)).toEqual(['America/New_York']);
  });

  it('sends it once the server can take it, and stops holding it', async () => {
    const { holdChangeOnDevice, sendUnsentChanges } = await freshOutbox();
    serverFails = true;

    await holdChangeOnDevice(
      change('America/New_York', '2026-09-14T15:00:00Z'),
    );
    await sendUnsentChanges();

    serverFails = false;
    await sendUnsentChanges();

    expect(created).toHaveLength(1);
    expect(onDevice()).toEqual([]);
  });

  it('does not send the id it uses to track the change', async () => {
    const { holdChangeOnDevice, sendUnsentChanges } = await freshOutbox();

    await holdChangeOnDevice(change('Europe/Kyiv', '2026-09-20T09:00:00Z'));
    await sendUnsentChanges();

    expect(created[0]).not.toHaveProperty('unsentId');
    expect(created[0]).not.toHaveProperty('attempts');
    expect(created[0]).toMatchObject({
      ianaTimezone: 'Europe/Kyiv',
      deviceId: 'device-1',
    });
  });

  it('sends several in the order they happened', async () => {
    const { holdChangeOnDevice, sendUnsentChanges } = await freshOutbox();
    serverFails = true;

    await holdChangeOnDevice(
      change('Pacific/Honolulu', '2026-09-02T17:00:00Z'),
    );
    await holdChangeOnDevice(
      change('America/New_York', '2026-09-14T15:00:00Z'),
    );

    serverFails = false;
    await sendUnsentChanges();

    expect(
      created.map((c) => (c as { ianaTimezone: string }).ianaTimezone),
    ).toEqual(['Pacific/Honolulu', 'America/New_York']);
  });

  it('sends a change once even when two sends overlap', async () => {
    const { holdChangeOnDevice, sendUnsentChanges } = await freshOutbox();

    await holdChangeOnDevice(change('Asia/Tokyo', '2026-09-16T07:00:00Z'));
    await Promise.all([
      sendUnsentChanges(),
      sendUnsentChanges(),
      sendUnsentChanges(),
    ]);

    expect(created).toHaveLength(1);
    expect(onDevice()).toEqual([]);
  });

  it('gives up on a change the server keeps refusing, and says so', async () => {
    const { holdChangeOnDevice, sendUnsentChanges } = await freshOutbox();
    serverFails = true;

    await holdChangeOnDevice(change('Asia/Tokyo', '2026-09-16T07:00:00Z'));
    for (let attempt = 0; attempt < 10; attempt += 1) await sendUnsentChanges();

    expect(onDevice()).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });
});
