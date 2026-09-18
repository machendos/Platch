/* A random id this install makes once and remembers. A grouping key for
 * "which device said this" — not a hardware id, never used for auth, and a
 * reinstall reads as a new device. See docs/timezone.md.
 */

import { deviceStorage } from './deviceStorage';

const DEVICE_ID_KEY = 'device-id';

/* `crypto.randomUUID` needs a secure context, and the simulator loads the dev
   server over the LAN address, which is not one. */
const newDeviceId = () =>
  crypto.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

let inFlight: Promise<string> | null = null;

const readOrCreate = async () => {
  const stored = await deviceStorage.get<string>(DEVICE_ID_KEY);
  if (stored) return stored;

  const created = newDeviceId();
  await deviceStorage.set(DEVICE_ID_KEY, created);

  return created;
};

export const getDeviceId = () => {
  inFlight ??= readOrCreate();

  return inFlight;
};
