import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import { buildCreateProjectDto } from './createProjectPayload';
import { EMPTY_TARGET } from './components/targetComponent/targetState';
import { ProjectStatus } from './components/projectStatusSwitch/ProjectStatusSwitch';

const EMPTY_VALUES = {
  name: '',
  goal: '',
  context: '',
  status: ProjectStatus.ACTIVE,
  isTimezoneFlexible: false,
};

const build = (over: Partial<Parameters<typeof buildCreateProjectDto>[0]>) =>
  buildCreateProjectDto({
    values: EMPTY_VALUES,
    target: EMPTY_TARGET,
    timeComponents: [],
    parentProjectId: null,
    colorId: null,
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
        isTimezoneFlexible: true,
      },
      target: {
        ...EMPTY_TARGET,
        timeNeededMinutes: 600,
        minBlockMinutes: 60,
      },
      parentProjectId: 'parent-1',
      colorId: 'color-1',
    });

    expect(dto).toMatchObject({
      name: 'Rebuild the shed',
      goal: 'Roof on',
      context: '- [ ] Order the felt',
      timeNeededMinutes: 600,
      minBlockMinutes: 60,
      projectStatus: 'BACKLOG',
      flexibleTimezone: true,
      originalTimezone: 'Europe/Kyiv',
      parentProjectId: 'parent-1',
      colorId: 'color-1',
    });
  });

  /* A key left out is a column left null. Sending '' instead would store a
     goal that exists and says nothing, which reads differently everywhere the
     project is shown. */
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

  /* A name is not required either. The column is nullable and an unnamed
     project reads as "(no name)" wherever it is shown, so an empty field must
     leave the key out rather than store a blank string that would render as a
     name of no characters. */
  it('leaves the name out when there is none', () => {
    expect(build({}).name).toBeUndefined();
    expect(
      build({ values: { ...EMPTY_VALUES, name: '   ' } }).name,
    ).toBeUndefined();
  });

  /* The one field with no empty state, so it is always sent — an unnamed,
     otherwise untouched project still says which list it belongs in. */
  it('always states a status, even for an otherwise empty form', () => {
    expect(build({}).projectStatus).toBe('ACTIVE');
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
