import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/preferences', () => ({
  Preferences: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
}));

import { Preferences } from '@capacitor/preferences';
import { deviceStorage } from './deviceStorage';

const get = vi.mocked(Preferences.get);
const set = vi.mocked(Preferences.set);

const never = () => new Promise<never>(() => {});
const after = (ms: number, value: unknown) =>
  new Promise((resolve) => setTimeout(resolve, ms, value));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('deviceStorage.get', () => {
  it('reads back what was written', async () => {
    get.mockResolvedValue({ value: '{"a":1}' });

    await expect(deviceStorage.get('k')).resolves.toEqual({ a: 1 });
  });

  it('reports an absent key as null', async () => {
    get.mockResolvedValue({ value: null });

    await expect(deviceStorage.get('k')).resolves.toBeNull();
  });

  it('reports an unparseable value as null', async () => {
    get.mockResolvedValue({ value: 'not json' });

    await expect(deviceStorage.get('k')).resolves.toBeNull();
  });

  // The bug this replaced left MainPage's render gate closed forever.
  it('reports a rejected read as null rather than rejecting', async () => {
    get.mockRejectedValue(new Error('plugin unavailable'));

    await expect(deviceStorage.get('k')).resolves.toBeNull();
  });

  it('gives up on a read that never settles, once past the timeout', async () => {
    get.mockReturnValue(never());

    await expect(deviceStorage.get('k', 40)).resolves.toBeNull();
  });

  it('keeps a read that beats the timeout', async () => {
    get.mockReturnValue(after(10, { value: '{"a":1}' }) as never);

    await expect(deviceStorage.get('k', 200)).resolves.toEqual({ a: 1 });
  });

  it('waits indefinitely when no timeout is asked for', async () => {
    get.mockReturnValue(never());

    const settled = await Promise.race([
      deviceStorage.get('k').then(() => 'read'),
      after(60, 'still waiting'),
    ]);

    expect(settled).toBe('still waiting');
  });
});

describe('deviceStorage.set', () => {
  it('swallows a failed write', async () => {
    set.mockRejectedValue(new Error('quota exceeded'));

    await expect(deviceStorage.set('k', { a: 1 })).resolves.toBeUndefined();
  });
});
