import { afterEach, describe, expect, it, vi } from 'vitest';
import { settledZone } from './helpers';

/* Returns one reading per call, then repeats the last one, so a
   test only has to write the readings that differ. */
const readings = (...zones: string[]) => {
  let index = 0;

  return () => zones[Math.min(index++, zones.length - 1)];
};

const settle = async (first: string, read: () => string) => {
  const result = settledZone(first, read);
  await vi.advanceTimersByTimeAsync(4000 * 4);

  return result;
};

describe('confirming a zone before it is written', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('trusts a reading two in a row agree on', async () => {
    vi.useFakeTimers();

    expect(await settle('Asia/Tokyo', readings('Asia/Tokyo'))).toBe(
      'Asia/Tokyo',
    );
  });

  it('follows a reading that moves, and records where it lands', async () => {
    vi.useFakeTimers();

    expect(
      await settle(
        'America/Los_Angeles',
        readings('Europe/Paris', 'Asia/Tokyo', 'Asia/Tokyo'),
      ),
    ).toBe('Asia/Tokyo');
  });

  it('gives up on a reading that never settles', async () => {
    vi.useFakeTimers();

    expect(
      await settle(
        'America/Los_Angeles',
        readings('Europe/Paris', 'Asia/Tokyo', 'America/Denver', 'Europe/Rome'),
      ),
    ).toBeNull();
  });

  it('settles back onto the zone it started from', async () => {
    vi.useFakeTimers();

    expect(
      await settle(
        'America/Los_Angeles',
        readings('Europe/Paris', 'America/Los_Angeles', 'America/Los_Angeles'),
      ),
    ).toBe('America/Los_Angeles');
  });
});
