import { describe, expect, it, vi } from 'vitest';
import { Temporal } from 'temporal-polyfill';

let requestedRange: { from: string; to: string } | null = null;

vi.mock('../system/api.client', () => ({
  getConnection: () => ({}),
  apiClient: {
    event: {
      getEventsInRange: async (
        _connection: unknown,
        query: { from: string; to: string },
      ) => {
        requestedRange = query;
        return [];
      },
      by_project: { getEventsOfProject: async () => [] },
    },
  },
}));

const { events } = await import('./event');
const { queryClient } = await import('./query.client');

const date = (year: number, month: number, day: number) =>
  new Temporal.PlainDate(year, month, day);

describe('getEventsInRange', () => {
  it('asks for exactly the range it was given, as dates', async () => {
    await events.getEventsInRange(date(2026, 9, 25), date(2026, 10, 7));

    expect(requestedRange).toEqual({ from: '2026-09-25', to: '2026-10-07' });
  });

  it('caches under that range', async () => {
    await events.getEventsInRange(date(2026, 10, 1), date(2026, 10, 7));

    expect(
      queryClient.getQueryData(['events', 'range', '2026-10-01', '2026-10-07']),
    ).toEqual([]);
  });
});
