import { Temporal } from 'temporal-polyfill';
import type { Project } from '../../api/project';
import type { Event } from '../../api/event';
import { spreadRecurringTimeComponent } from './spread.recurring.time.component';
import {
  overlapsDateFrame,
  resolveInViewerZone,
} from './resolve.in.viewer.zone';
import type { SpreadEvent, TimezoneChange } from './resolve.in.viewer.zone';

export type { SpreadEvent } from './resolve.in.viewer.zone';

export const spreadProjectsToEvents = (
  projects: Project[],
  events: Event[],
  dateFrame: [Temporal.PlainDate, Temporal.PlainDate],
  timezoneChanges: TimezoneChange[],
): SpreadEvent[] => {
  const projectById = new Map(projects.map((project) => [project.id, project]));

  const fromEvents = events.flatMap((event) => {
    const project = projectById.get(event.projectId);
    if (!project || event.start === null || event.end === null) return [];

    const resolved = resolveInViewerZone(
      project,
      { start: event.start, end: event.end },
      timezoneChanges,
    );

    return overlapsDateFrame(resolved, dateFrame) ? [resolved] : [];
  });

  const fromCadences = projects.flatMap((project) =>
    project.recurringTimeComponents.flatMap((component) =>
      spreadRecurringTimeComponent(
        component,
        project,
        dateFrame,
        timezoneChanges,
      ),
    ),
  );

  return [...fromEvents, ...fromCadences];
};
