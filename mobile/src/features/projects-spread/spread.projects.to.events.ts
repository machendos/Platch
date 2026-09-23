import { Temporal } from 'temporal-polyfill';
import type { Project } from '../../api/project';
import type { Event } from '../../api/event';
import { ProjectType } from '../../modals/components/projectTypeSwitch/ProjectTypeSwitch';
import { getTimezoneAtMoment } from '../timezone/useTimezone';
import { isDefined } from '../../system/helpers/helpers';

export type SpreadEvent = {
  start: Temporal.PlainDateTime;
  end: Temporal.PlainDateTime;
  project: Project;
};

type TimezoneChange = { changesAt: Temporal.Instant; ianaTimezone: string };

const resolve = (
  project: Project,
  event: Event,
  timezoneChanges: TimezoneChange[],
): SpreadEvent | undefined => {
  if (!event.start || !event.end) return undefined;

  const { start, end } = event;

  if (project.projectType === ProjectType.INTERNAL)
    return { start, end, project };

  const projectTz = project.originalTimezone;
  const tzAtStart = getTimezoneAtMoment(
    timezoneChanges,
    start.toZonedDateTime(projectTz).toInstant(),
  );

  const inViewerZone = (moment: Temporal.PlainDateTime) =>
    moment.toZonedDateTime(projectTz).withTimeZone(tzAtStart).toPlainDateTime();

  return { start: inViewerZone(start), end: inViewerZone(end), project };
};

export const spreadProjectsToEvents = (
  projects: Project[],
  events: Event[],
  dateFrame: [Temporal.PlainDate, Temporal.PlainDate],
  timezoneChanges: TimezoneChange[],
): SpreadEvent[] => {
  const projectById = new Map(projects.map((project) => [project.id, project]));

  const frameStart = dateFrame[0].toPlainDateTime('00:00');
  const frameEnd = dateFrame[1].add({ days: 1 }).toPlainDateTime('00:00');

  return events
    .map((event) => {
      const project = projectById.get(event.projectId);

      return project ? resolve(project, event, timezoneChanges) : undefined;
    })
    .filter(isDefined)
    .filter(
      ({ start, end }) =>
        Temporal.PlainDateTime.compare(end, frameStart) > 0 &&
        Temporal.PlainDateTime.compare(start, frameEnd) < 0,
    );
};
