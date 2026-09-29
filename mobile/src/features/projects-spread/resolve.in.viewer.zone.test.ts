import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import { widenForZoneShift } from './resolve.in.viewer.zone';

const date = (year: number, month: number, day: number) =>
  new Temporal.PlainDate(year, month, day);

describe('widenForZoneShift', () => {
  it('reaches back far enough for a 26 hour shift and a 24 hour span', () => {
    const [from, to] = widenForZoneShift([date(2026, 9, 25), date(2026, 9, 25)]);

    expect(from.toString()).toBe('2026-09-22');
    expect(to.toString()).toBe('2026-09-27');
  });

  it('crosses a month boundary rather than clamping inside it', () => {
    const [from, to] = widenForZoneShift([date(2026, 3, 1), date(2026, 3, 31)]);

    expect(from.toString()).toBe('2026-02-26');
    expect(to.toString()).toBe('2026-04-02');
  });
});
