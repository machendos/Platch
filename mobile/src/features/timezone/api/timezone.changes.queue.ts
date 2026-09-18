/* Changes held on the device until the server takes them.
 *
 * The list in memory is the source of truth and is written to storage after
 * every change. Nothing here reads storage in order to modify it, so there is
 * no read-modify-write to serialise. See docs/timezone.md.
 */

import { useSyncExternalStore } from 'react';
import { Temporal } from 'temporal-polyfill';
import { apiClient, getConnection } from '../../../system/api.client';
import { deviceStorage } from '../../../system/device-storage/deviceStorage';
import { queryClient } from '../../../api/query.client';
import type { CreateTimezoneChangeDto } from '../../../api/sdk/structures/CreateTimezoneChangeDto';

const STORAGE_KEY = 'timezone-change-queue';

/* Held here because delivery is what makes a stored change appear: this is the
   only thing that invalidates it. */
export const SERVER_CHANGES_QUERY_KEY = ['timezone_change'] as const;

/* A change the server keeps refusing is never going to be accepted, and
   retrying it for ever would keep it invisible. It is dropped loudly instead. */
const MAX_ATTEMPTS = 10;

export type UnsentChange = CreateTimezoneChangeDto & {
  unsentId: string;
  attempts?: number;
};

let unsentChanges: UnsentChange[] = [];
let loadedFromStorage = false;
const listeners = new Set<() => void>();

const publish = (changes: UnsentChange[]) => {
  unsentChanges = changes;
  void deviceStorage.set(STORAGE_KEY, changes);
  listeners.forEach((notify) => notify());
};

const loadOnce = async () => {
  if (loadedFromStorage) return;
  loadedFromStorage = true;

  const stored = await deviceStorage.get<UnsentChange[]>(STORAGE_KEY);
  if (stored?.length) publish(stored);
};

export const readUnsentChanges = async () => {
  await loadOnce();

  return unsentChanges;
};

export const useUnsentChanges = () =>
  useSyncExternalStore(
    (notify) => {
      listeners.add(notify);

      return () => listeners.delete(notify);
    },
    () => unsentChanges,
  );

export const unsentChangesAsTimeline = (changes: UnsentChange[]) =>
  changes.map((change) => ({
    ...change,
    changesAt: Temporal.Instant.from(change.changesAt),
  }));

export const holdChangeOnDevice = async (change: UnsentChange) => {
  await loadOnce();
  publish([...unsentChanges, change]);

  void sendUnsentChanges();
};

const deliver = async () => {
  await loadOnce();
  if (unsentChanges.length === 0) return;

  const delivered = new Set<string>();
  const failed = new Set<string>();

  for (const change of unsentChanges) {
    const { unsentId, attempts, ...dto } = change;

    try {
      await apiClient.timezone_change.createTimezoneChange(
        getConnection(),
        dto,
      );
      delivered.add(unsentId);
    } catch (error) {
      failed.add(unsentId);
      console.warn('Timezone change not sent, will retry', {
        zone: change.ianaTimezone,
        attempt: (attempts ?? 0) + 1,
        error,
      });
    }
  }

  /* Rebuilt from the list as it stands now, so a change recorded while the
     requests were in the air survives. */
  const remaining = unsentChanges
    .filter((change) => !delivered.has(change.unsentId))
    .map((change) =>
      failed.has(change.unsentId)
        ? { ...change, attempts: (change.attempts ?? 0) + 1 }
        : change,
    )
    .filter((change) => {
      const givingUp = (change.attempts ?? 0) >= MAX_ATTEMPTS;

      if (givingUp) {
        console.error('Timezone change dropped after repeated failures', {
          zone: change.ianaTimezone,
          changesAt: change.changesAt,
        });
      }

      return !givingUp;
    });

  publish(remaining);

  if (delivered.size > 0) {
    await queryClient.invalidateQueries({ queryKey: SERVER_CHANGES_QUERY_KEY });
  }
};

/* One send at a time: two that read the same list both deliver it before
   either removes it, and the change lands on the server twice. */
let deliveryInFlight: Promise<void> | null = null;

export const sendUnsentChanges = () => {
  deliveryInFlight ??= deliver().finally(() => {
    deliveryInFlight = null;
  });

  return deliveryInFlight;
};

window.addEventListener('online', () => void sendUnsentChanges());
