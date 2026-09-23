import { describe, expect, it, vi } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import type { CreateProjectDto } from './sdk/structures/CreateProjectDto';
import type { UpdateProjectDto } from './sdk/structures/UpdateProjectDto';

let sentCreate: CreateProjectDto | null = null;
let sentUpdate: UpdateProjectDto | null = null;

vi.mock('../system/api.client', () => ({
  getConnection: () => ({}),
  apiClient: {
    project: {
      getProjectsByUser: async () => ({ version: 1, projects: [] }),
      createProject: async (_connection: unknown, dto: CreateProjectDto) => {
        sentCreate = dto;
        return {};
      },
      updateProject: async (_connection: unknown, dto: UpdateProjectDto) => {
        sentUpdate = dto;
        return {};
      },
      move: { moveProject: async () => ({}) },
    },
  },
}));

const { projects, NO_PROJECT_CHANGES } = await import('./project');

const date = (year: number, month: number, day: number) =>
  new Temporal.PlainDate(year, month, day);

const EMPTY_PROJECT = {
  name: 'Ship it',
  goal: '',
  context: '',
  projectType: 'EXTERNAL' as const,
  colorId: null,
  timeNeededMinutes: null,
  minBlockMinutes: null,
  repetitionsNeeded: null,
  earliestDate: null,
  earliestTime: null,
  deadlineDate: null,
  deadlineTime: null,
};

describe('createProject', () => {
  it('sends an event span at minute precision, with no zone marker', async () => {
    await projects.createProject({
      ...EMPTY_PROJECT,
      projectStatus: 'ACTIVE',
      parentProjectId: null,
      originalTimezone: 'America/Los_Angeles',
      recurringTimeComponents: [],
      events: [
        {
          start: new Temporal.PlainDateTime(2026, 6, 19, 17, 45),
          end: new Temporal.PlainDateTime(2026, 6, 19, 18, 45),
        },
      ],
    });

    const [event] = sentCreate?.events ?? [];

    expect(event.start).toBe('2026-06-19T17:45');
    expect(event.end).toBe('2026-06-19T18:45');
    expect(event.start).not.toMatch(/Z$/);
  });

  it('sends a cadence bound at midnight, with no zone marker', async () => {
    await projects.createProject({
      ...EMPTY_PROJECT,
      projectStatus: 'ACTIVE',
      parentProjectId: null,
      originalTimezone: 'America/Los_Angeles',
      events: [],
      recurringTimeComponents: [
        {
          recurringInterval: 1,
          recurringFrequency: 'WEEK',
          recurringByDay: ['MO'],
          recurringByMonthDay: null,
          recurringByMonth: null,
          firstRecurringEventAt: date(2026, 6, 1),
          lastRecurringEventAt: date(2026, 7, 1),
          recurringTimeSlots: [
            {
              from: new Temporal.PlainTime(9, 0),
              to: new Temporal.PlainTime(10, 0),
              flexibleMinutesNeeded: null,
            },
          ],
        },
      ],
    });

    const [component] = sentCreate?.recurringTimeComponents ?? [];

    expect(component.firstRecurringEventAt).toBe('2026-06-01T00:00');
    expect(component.lastRecurringEventAt).toBe('2026-07-01T00:00');
    expect(component.firstRecurringEventAt).not.toMatch(/Z$/);
    expect(component.recurringTimeSlots?.[0]).toEqual({
      type: 'ABSOLUTE',
      from: '09:00',
      to: '10:00',
    });
  });

  it('sends a project date as a date, not a date-time', async () => {
    await projects.createProject({
      ...EMPTY_PROJECT,
      projectStatus: 'ACTIVE',
      parentProjectId: null,
      originalTimezone: 'America/Los_Angeles',
      recurringTimeComponents: [],
      events: [],
      deadlineDate: date(2026, 6, 30),
      deadlineTime: new Temporal.PlainTime(17, 0),
    });

    expect(sentCreate?.deadlineDate).toBe('2026-06-30');
    expect(sentCreate?.deadlineTime).toBe('17:00');
  });
});

describe('updateProject', () => {
  it('clears a bound the form emptied rather than leaving it alone', async () => {
    await projects.updateProject({
      ...EMPTY_PROJECT,
      ...NO_PROJECT_CHANGES,
      id: 'p1',
    });

    expect(sentUpdate?.deadlineDate).toBeNull();
    expect(sentUpdate?.earliestTime).toBeNull();
  });

  it('keeps an updated slot id so the events pointing at it survive', async () => {
    await projects.updateProject({
      ...EMPTY_PROJECT,
      ...NO_PROJECT_CHANGES,
      id: 'p1',
      updatedRecurringTimeComponents: [
        {
          id: 'c1',
          recurringInterval: 1,
          recurringFrequency: 'WEEK',
          recurringByDay: ['MO'],
          recurringByMonthDay: null,
          recurringByMonth: null,
          firstRecurringEventAt: date(2026, 6, 1),
          lastRecurringEventAt: null,
          recurringTimeSlots: [
            {
              id: 's1',
              from: new Temporal.PlainTime(9, 0),
              to: new Temporal.PlainTime(10, 0),
              flexibleMinutesNeeded: null,
            },
          ],
        },
      ],
    });

    const [component] = sentUpdate?.updatedRecurringTimeComponents ?? [];

    expect(component.id).toBe('c1');
    expect(component.recurringTimeSlots?.[0]).toMatchObject({ id: 's1' });
  });
});
