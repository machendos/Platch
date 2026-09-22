import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import type { ProjectWithTimeSlots } from '../api/sdk/structures/ProjectWithTimeSlots';
import {
  buildCreateProjectDto,
  buildUpdateProjectDto,
  toProjectFormValues,
  toTargetDraft,
} from './projectPayload';
import { EMPTY_TARGET } from './components/targetComponent/targetState';
import { NO_TIME_COMPONENT_CHANGES } from './components/timeComponents/timeComponentsState';
import { ProjectStatus } from './components/projectStatusSwitch/ProjectStatusSwitch';
import { ProjectType } from './components/projectTypeSwitch/ProjectTypeSwitch';

const EMPTY_VALUES = {
  name: '',
  goal: '',
  context: '',
  status: ProjectStatus.ACTIVE,
  type: ProjectType.EXTERNAL,
  colorId: null,
};

const build = (over: Partial<Parameters<typeof buildCreateProjectDto>[0]>) =>
  buildCreateProjectDto({
    values: EMPTY_VALUES,
    target: EMPTY_TARGET,
    timeComponents: [],
    parentProjectId: null,
    timeZone: 'Europe/Kyiv',
    ...over,
  });

describe('buildCreateProjectDto', () => {
  it('carries every field of a filled form', () => {
    const dto = build({
      values: {
        name: 'Rebuild the shed',
        goal: 'Roof on',
        context: '- [ ] Order the felt',
        status: ProjectStatus.BACKLOG,
        type: ProjectType.INTERNAL,
        colorId: 'color-1',
      },
      target: {
        ...EMPTY_TARGET,
        timeNeededMinutes: 600,
        minBlockMinutes: 60,
      },
      parentProjectId: 'parent-1',
    });

    expect(dto).toMatchObject({
      name: 'Rebuild the shed',
      goal: 'Roof on',
      context: '- [ ] Order the felt',
      timeNeededMinutes: 600,
      minBlockMinutes: 60,
      projectStatus: 'BACKLOG',
      projectType: 'INTERNAL',
      originalTimezone: 'Europe/Kyiv',
      parentProjectId: 'parent-1',
      colorId: 'color-1',
    });
  });

  it('leaves out what was never filled in, rather than sending it empty', () => {
    const dto = build({});

    expect(dto.goal).toBeUndefined();
    expect(dto.context).toBeUndefined();
    expect(dto.timeNeededMinutes).toBeUndefined();
    expect(dto.repetitionsNeeded).toBeUndefined();
    expect(dto.earliestDate).toBeUndefined();
    expect(dto.parentProjectId).toBeUndefined();
    expect(dto.colorId).toBeUndefined();
  });

  it('treats whitespace as never filled in', () => {
    const dto = build({
      values: { ...EMPTY_VALUES, name: '  Shed  ', goal: '   ' },
    });

    expect(dto.name).toBe('Shed');
    expect(dto.goal).toBeUndefined();
  });

  it('leaves the name out when there is none', () => {
    expect(build({}).name).toBeUndefined();
    expect(
      build({ values: { ...EMPTY_VALUES, name: '   ' } }).name,
    ).toBeUndefined();
  });

  it('always states a status and a type, even for an otherwise empty form', () => {
    expect(build({}).projectStatus).toBe('ACTIVE');
    expect(build({}).projectType).toBe('EXTERNAL');
  });

  it('serialises the window into the shapes the DTO asks for', () => {
    const dto = build({
      target: {
        ...EMPTY_TARGET,
        earliestDate: new Temporal.PlainDate(2026, 6, 19),
        earliestTime: new Temporal.PlainTime(17, 45),
        deadlineDate: new Temporal.PlainDate(2026, 7, 1),
        deadlineTime: new Temporal.PlainTime(9, 0),
      },
    });

    expect(dto.earliestDate).toBe('2026-06-19');
    expect(dto.earliestTime).toBe('17:45:00');
    expect(dto.deadlineDate).toBe('2026-07-01');
    expect(dto.deadlineTime).toBe('09:00:00');
  });
});

const buildUpdate = (
  over: Partial<Parameters<typeof buildUpdateProjectDto>[0]>,
) =>
  buildUpdateProjectDto({
    id: 'project-1',
    values: EMPTY_VALUES,
    target: EMPTY_TARGET,
    timeComponentsChanges: NO_TIME_COMPONENT_CHANGES,
    ...over,
  });

describe('buildUpdateProjectDto', () => {
  it('sends an emptied field as null rather than leaving it out', () => {
    const dto = buildUpdate({});

    expect(dto.goal).toBeNull();
    expect(dto.context).toBeNull();
    expect(dto.name).toBeNull();
    expect(dto.timeNeededMinutes).toBeNull();
    expect(dto.earliestDate).toBeNull();
    expect(dto.colorId).toBeNull();
  });

  it('carries every field of a filled form', () => {
    const dto = buildUpdate({
      values: {
        name: 'Rebuild the shed',
        goal: 'Roof on',
        context: '- [ ] Order the felt',
        status: ProjectStatus.BACKLOG,
        type: ProjectType.INTERNAL,
        colorId: 'color-1',
      },
      target: {
        ...EMPTY_TARGET,
        timeNeededMinutes: 600,
        earliestDate: new Temporal.PlainDate(2026, 6, 19),
        earliestTime: new Temporal.PlainTime(17, 45),
      },
    });

    expect(dto).toMatchObject({
      id: 'project-1',
      name: 'Rebuild the shed',
      goal: 'Roof on',
      projectType: 'INTERNAL',
      colorId: 'color-1',
      timeNeededMinutes: 600,
      earliestDate: '2026-06-19',
      earliestTime: '17:45:00',
    });
  });

  it('never restates the parent, the category or the original timezone', () => {
    const dto = buildUpdate({});

    expect('parentProjectId' in dto).toBe(false);
    expect('projectStatus' in dto).toBe(false);
    expect('originalTimezone' in dto).toBe(false);
  });

  it('always states all three time component lists', () => {
    const dto = buildUpdate({});

    expect(dto.createdTimeComponents).toEqual([]);
    expect(dto.updatedTimeComponents).toEqual([]);
    expect(dto.deletedTimeComponentIds).toEqual([]);
  });

  it('passes the time component changes through untouched', () => {
    const changes = {
      createdTimeComponents: [{ type: 'ABSOLUTE' as const }],
      updatedTimeComponents: [{ id: 'tc-1', type: 'RECURRING' as const }],
      deletedTimeComponentIds: ['tc-2'],
    };

    expect(buildUpdate({ timeComponentsChanges: changes })).toMatchObject(
      changes,
    );
  });
});

const apiProject = (
  over: Partial<ProjectWithTimeSlots> = {},
): ProjectWithTimeSlots => ({
  timeComponents: [],
  color: null,
  name: null,
  id: 'project-1',
  goal: null,
  context: null,
  timeNeededMinutes: null,
  minBlockMinutes: null,
  repetitionsNeeded: null,
  earliestDate: null,
  earliestTime: null,
  deadlineDate: null,
  deadlineTime: null,
  projectStatus: 'ACTIVE',
  projectType: 'EXTERNAL',
  originalTimezone: 'Europe/Kyiv',
  parentProjectId: null,
  colorId: null,
  position: 'a0',
  userId: 'user-1',
  ...over,
});

describe('toProjectFormValues', () => {
  it('reads a null column as an empty field', () => {
    const values = toProjectFormValues(apiProject());

    expect(values).toMatchObject({ name: '', goal: '', context: '' });
  });

  it('carries the status, the type and the colour', () => {
    const values = toProjectFormValues(
      apiProject({
        name: 'Shed',
        projectStatus: 'BACKLOG',
        projectType: 'INTERNAL',
        colorId: 'color-1',
      }),
    );

    expect(values).toEqual({
      name: 'Shed',
      goal: '',
      context: '',
      status: 'BACKLOG',
      type: 'INTERNAL',
      colorId: 'color-1',
    });
  });
});

describe('toTargetDraft', () => {
  it('reads the wall-clock fields the columns were written with', () => {
    const draft = toTargetDraft(
      apiProject({
        earliestDate: '2026-06-19T00:00:00.000Z',
        earliestTime: '1970-01-01T17:45:00.000Z',
        deadlineDate: '2026-07-01T00:00:00.000Z',
        deadlineTime: '1970-01-01T09:00:00.000Z',
      }),
    );

    expect(draft.earliestDate?.toString()).toBe('2026-06-19');
    expect(draft.earliestTime?.toString()).toBe('17:45:00');
    expect(draft.deadlineDate?.toString()).toBe('2026-07-01');
    expect(draft.deadlineTime?.toString()).toBe('09:00:00');
  });

  it('leaves an unset bound null', () => {
    const draft = toTargetDraft(apiProject());

    expect(draft).toEqual(EMPTY_TARGET);
  });

  it('carries the targets as they stand', () => {
    const draft = toTargetDraft(
      apiProject({
        timeNeededMinutes: 600,
        minBlockMinutes: 60,
        repetitionsNeeded: 3,
      }),
    );

    expect(draft).toMatchObject({
      timeNeededMinutes: 600,
      minBlockMinutes: 60,
      repetitionsNeeded: 3,
    });
  });
});

describe('reading a project and sending it back', () => {
  it('returns the same window it was given', () => {
    const project = apiProject({
      name: 'Shed',
      earliestDate: '2026-06-19T00:00:00.000Z',
      earliestTime: '1970-01-01T17:45:00.000Z',
    });

    const dto = buildUpdateProjectDto({
      id: project.id,
      values: toProjectFormValues(project),
      target: toTargetDraft(project),
      timeComponentsChanges: NO_TIME_COMPONENT_CHANGES,
    });

    expect(dto).toMatchObject({
      name: 'Shed',
      earliestDate: '2026-06-19',
      earliestTime: '17:45:00',
    });
  });
});
