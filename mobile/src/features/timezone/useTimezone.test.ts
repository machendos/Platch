import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import { zoneAtMoment } from './useTimezone';

const change = (zone: string, at: string) => ({
  ianaTimezone: zone,
  changesAt: Temporal.Instant.from(at),
});

const timeline = [
  change('America/Los_Angeles', '2026-09-01T12:00:00Z'),
  change('Asia/Tokyo', '2026-09-10T12:00:00Z'),
  change('Europe/Kyiv', '2026-09-20T12:00:00Z'),
];

const at = (moment: string) => zoneAtMoment(timeline, new Date(moment));

describe('the zone a timeline asserts at a moment', () => {
  it('asserts nothing when there is nothing recorded', () => {
    expect(zoneAtMoment([], new Date('2026-09-14T12:00:00Z'))).toBeNull();
  });

  it('holds the zone in force between two changes', () => {
    expect(at('2026-09-05T00:00:00Z')).toBe('America/Los_Angeles');
    expect(at('2026-09-14T00:00:00Z')).toBe('Asia/Tokyo');
  });

  it('holds the last zone for every moment after the last change', () => {
    expect(at('2026-12-31T00:00:00Z')).toBe('Europe/Kyiv');
  });

  it('reaches back with the earliest zone', () => {
    expect(at('2020-01-01T00:00:00Z')).toBe('America/Los_Angeles');
  });

  it('compares instants without tripping over valueOf', () => {
    expect(() => at('2026-09-14T00:00:00Z')).not.toThrow();
  });
});
