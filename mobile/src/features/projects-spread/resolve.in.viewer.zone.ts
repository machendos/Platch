import { Temporal } from 'temporal-polyfill';
import type { Project } from '../../api/project';
import { ProjectType } from '../../modals/components/projectTypeSwitch/ProjectTypeSwitch';
import { getTimezoneAtMoment } from '../timezone/useTimezone';

export type TimeSpan = {
  start: Temporal.PlainDateTime;
  end: Temporal.PlainDateTime;
};

export type TimezoneChange = {
  changesAt: Temporal.Instant;
  ianaTimezone: string;
};

export type SpreadEvent = TimeSpan & { project: Project };

export const resolveInViewerZone = (
  project: Project,
  { start, end }: TimeSpan,
  timezoneChanges: TimezoneChange[],
): SpreadEvent => {
  if (project.projectType === ProjectType.INTERNAL)
    return { start, end, project };

  const projectTimezone = project.originalTimezone;
  const startsAt = start.toZonedDateTime(projectTimezone).toInstant();
  const viewerTimezone = getTimezoneAtMoment(timezoneChanges, startsAt);

  const inViewerZone = (moment: Temporal.PlainDateTime) =>
    moment
      .toZonedDateTime(projectTimezone)
      .withTimeZone(viewerTimezone)
      .toPlainDateTime();

  return { start: inViewerZone(start), end: inViewerZone(end), project };
};

export const overlapsDateFrame = (
  { start, end }: TimeSpan,
  [frameStart, frameEnd]: [Temporal.PlainDate, Temporal.PlainDate],
): boolean =>
  Temporal.PlainDateTime.compare(end, frameStart.toPlainDateTime('00:00')) >
    0 &&
  Temporal.PlainDateTime.compare(
    start,
    frameEnd.add({ days: 1 }).toPlainDateTime('00:00'),
  ) < 0;
