import { Temporal } from 'temporal-polyfill';
import type { Project } from '../../api/project';
import { ProjectType } from '../../modals/components/projectTypeSwitch/ProjectTypeSwitch';
import { getTimezoneAtMoment } from '../timezone/useTimezone';
import type { DateRange } from '../../system/helpers/dateRange';

export type TimeSpan = {
  start: Temporal.PlainDateTime;
  end: Temporal.PlainDateTime;
};

export type TimezoneChange = {
  changesAt: Temporal.Instant;
  ianaTimezone: string;
};

export type SpreadEvent = TimeSpan & { project: Project };

const ZONE_SHIFT_MARGIN_DAYS_BEFORE = 3;
const ZONE_SHIFT_MARGIN_DAYS_AFTER = 2;

export const widenForZoneShift = ([from, to]: DateRange): DateRange => [
  from.subtract({ days: ZONE_SHIFT_MARGIN_DAYS_BEFORE }),
  to.add({ days: ZONE_SHIFT_MARGIN_DAYS_AFTER }),
];

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
  [frameStart, frameEnd]: DateRange,
): boolean =>
  Temporal.PlainDateTime.compare(end, frameStart.toPlainDateTime('00:00')) >
    0 &&
  Temporal.PlainDateTime.compare(
    start,
    frameEnd.add({ days: 1 }).toPlainDateTime('00:00'),
  ) < 0;
