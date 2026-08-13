import { Preferences } from '@capacitor/preferences';

// The timer is deliberately not cleared when the read wins: `Promise.race` has
// already subscribed to this promise, so the late rejection is absorbed there
// rather than surfacing as an unhandled one.
const rejectAfter = (ms: number) =>
  new Promise<never>((_, reject) =>
    setTimeout(
      reject,
      ms,
      new Error(`Device storage read timed out (${ms}ms)`),
    ),
  );

/**
 * JSON values kept on the device, on top of Capacitor Preferences.
 *
 * Nothing here rejects. A value that was never written, one that will not
 * parse, a plugin that is unavailable and a read that timed out are all
 * reported the same way — `null` for reads, silence for writes — so a caller
 * only ever has to handle "nothing usable", and a storage fault can never take
 * the UI down with it.
 */
export const deviceStorage = {
  /**
   * `timeoutMs` bounds the read, giving back `null` once it is exceeded. Pass
   * it when something is waiting on the value before it can render; leave it
   * off to wait for as long as the read takes.
   */
  async get<T>(key: string, timeoutMs?: number): Promise<T | null> {
    try {
      const read = Preferences.get({ key });
      const { value } = await (timeoutMs === undefined
        ? read
        : Promise.race([read, rejectAfter(timeoutMs)]));

      return value === null ? null : (JSON.parse(value) as T);
    } catch {
      return null;
    }
  },

  async set(key: string, value: unknown): Promise<void> {
    try {
      await Preferences.set({ key, value: JSON.stringify(value) });
    } catch {
      // Writes are fired without being awaited, so a rejection here would
      // arrive as an unhandled one rather than as anything a caller can act on.
    }
  },

  async remove(key: string): Promise<void> {
    try {
      await Preferences.remove({ key });
    } catch {
      // As above.
    }
  },
};
