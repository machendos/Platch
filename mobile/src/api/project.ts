import { useQuery } from '@tanstack/react-query';
import { Temporal } from 'temporal-polyfill';
import type { CreateProjectDto } from './sdk/structures/CreateProjectDto';
import type { EventFields } from './sdk/structures/EventFields';
import type { MoveProjectDto } from './sdk/structures/MoveProjectDto';
import type { ProjectWithTimeSlots } from './sdk/structures/ProjectWithTimeSlots';
import type { RecurringTimeComponentFields } from './sdk/structures/RecurringTimeComponentFields';
import type { TimeSlot } from './sdk/structures/TimeSlot';
import type { UpdateProjectDto } from './sdk/structures/UpdateProjectDto';
import type { UpdateRecurringTimeComponentDto } from './sdk/structures/UpdateRecurringTimeComponentDto';
import { apiClient, getConnection } from '../system/api.client';
import {
  fromApiStringToPlainDate,
  fromApiStringToPlainTime,
  fromPlainDateToApiDate,
  fromPlainDateToApiDateTime,
  fromPlainDateTimeToApiDateTime,
  fromPlainTimeToApiTime,
} from '../system/helpers/dateConversions';
import { COLORS_KEY } from './color';
import { queryClient } from './query.client';
import { EVENTS_KEY } from './event';

export const PROJECTS_KEY = ['projects'] as const;

type ComponentFromApi = ProjectWithTimeSlots['recurringTimeComponents'][number];
type SlotFromApi = ComponentFromApi['recurringTimeSlots'][number];

export type Slot = Omit<SlotFromApi, 'from' | 'to'> & {
  from: Temporal.PlainTime | null;
  to: Temporal.PlainTime | null;
};

export type RecurringTimeComponent = Omit<
  ComponentFromApi,
  'firstRecurringEventAt' | 'lastRecurringEventAt' | 'recurringTimeSlots'
> & {
  firstRecurringEventAt: Temporal.PlainDate | null;
  lastRecurringEventAt: Temporal.PlainDate | null;
  recurringTimeSlots: Slot[];
};

export type Project = Omit<
  ProjectWithTimeSlots,
  | 'earliestDate'
  | 'earliestTime'
  | 'deadlineDate'
  | 'deadlineTime'
  | 'recurringTimeComponents'
> & {
  earliestDate: Temporal.PlainDate | null;
  earliestTime: Temporal.PlainTime | null;
  deadlineDate: Temporal.PlainDate | null;
  deadlineTime: Temporal.PlainTime | null;
  recurringTimeComponents: RecurringTimeComponent[];
};

export type SlotToCreate = Omit<
  Slot,
  'id' | 'type' | 'recurringTimeComponentId'
> & { id?: string };

export type RecurringTimeComponentToCreate = Omit<
  RecurringTimeComponent,
  'id' | 'projectId' | 'recurringTimeSlots'
> & { recurringTimeSlots: SlotToCreate[] };

export type RecurringTimeComponentToUpdate = RecurringTimeComponentToCreate & {
  id: string;
};

export type EventToCreate = {
  start: Temporal.PlainDateTime | null;
  end: Temporal.PlainDateTime | null;
};

export type EventToUpdate = EventToCreate & { id: string };

export type ProjectChanges = {
  createdRecurringTimeComponents: RecurringTimeComponentToCreate[];
  updatedRecurringTimeComponents: RecurringTimeComponentToUpdate[];
  deletedRecurringTimeComponentIds: string[];
  createdEvents: EventToCreate[];
  updatedEvents: EventToUpdate[];
  deletedEventIds: string[];
};

export const NO_PROJECT_CHANGES: ProjectChanges = {
  createdRecurringTimeComponents: [],
  updatedRecurringTimeComponents: [],
  deletedRecurringTimeComponentIds: [],
  createdEvents: [],
  updatedEvents: [],
  deletedEventIds: [],
};

export type ProjectTarget = {
  timeNeededMinutes: number | null;
  minBlockMinutes: number | null;
  repetitionsNeeded: number | null;
  earliestDate: Temporal.PlainDate | null;
  earliestTime: Temporal.PlainTime | null;
  deadlineDate: Temporal.PlainDate | null;
  deadlineTime: Temporal.PlainTime | null;
};

export type ProjectToCreate = ProjectTarget & {
  name: string;
  goal: string;
  context: string;
  projectStatus: Project['projectStatus'];
  projectType: Project['projectType'];
  colorId: string | null;
  parentProjectId: string | null;
  originalTimezone: string;
  recurringTimeComponents: RecurringTimeComponentToCreate[];
  events: EventToCreate[];
};

export type ProjectToUpdate = ProjectTarget &
  ProjectChanges & {
    id: string;
    name: string;
    goal: string;
    context: string;
    projectType: Project['projectType'];
    colorId: string | null;
  };

const readOptional =
  <T>(read: (value: string) => T) =>
  (value: string | null) =>
    value === null ? null : read(value);

const toPlainDate = readOptional(fromApiStringToPlainDate);
const toPlainTime = readOptional(fromApiStringToPlainTime);

const toProject = (project: ProjectWithTimeSlots): Project => ({
  ...project,
  earliestDate: toPlainDate(project.earliestDate),
  earliestTime: toPlainTime(project.earliestTime),
  deadlineDate: toPlainDate(project.deadlineDate),
  deadlineTime: toPlainTime(project.deadlineTime),
  recurringTimeComponents: project.recurringTimeComponents.map((component) => ({
    ...component,
    firstRecurringEventAt: toPlainDate(component.firstRecurringEventAt),
    lastRecurringEventAt: toPlainDate(component.lastRecurringEventAt),
    recurringTimeSlots: component.recurringTimeSlots.map((slot) => ({
      ...slot,
      from: toPlainTime(slot.from),
      to: toPlainTime(slot.to),
    })),
  })),
});

const toTimeSlot = (slot: SlotToCreate): TimeSlot =>
  slot.flexibleMinutesNeeded !== null
    ? { type: 'FLEXIBLE', flexibleMinutesNeeded: slot.flexibleMinutesNeeded }
    : {
        type: 'ABSOLUTE',
        from: slot.from ? fromPlainTimeToApiTime(slot.from) : undefined,
        to: slot.to ? fromPlainTimeToApiTime(slot.to) : undefined,
      };

const toRecurringTimeComponentFields = (
  component: RecurringTimeComponentToCreate,
): RecurringTimeComponentFields => ({
  recurringInterval: component.recurringInterval,
  recurringFrequency: component.recurringFrequency,
  recurringByDay:
    component.recurringFrequency === 'WEEK'
      ? component.recurringByDay
      : undefined,
  recurringByMonthDay:
    component.recurringFrequency === 'MONTH' ||
    component.recurringFrequency === 'YEAR'
      ? (component.recurringByMonthDay ?? undefined)
      : undefined,
  recurringByMonth:
    component.recurringFrequency === 'YEAR'
      ? (component.recurringByMonth ?? undefined)
      : undefined,
  firstRecurringEventAt: component.firstRecurringEventAt
    ? fromPlainDateToApiDateTime(component.firstRecurringEventAt)
    : undefined,
  lastRecurringEventAt: component.lastRecurringEventAt
    ? fromPlainDateToApiDateTime(component.lastRecurringEventAt)
    : undefined,
  recurringTimeSlots: component.recurringTimeSlots.map(toTimeSlot),
});

const toUpdateRecurringTimeComponentDto = (
  component: RecurringTimeComponentToUpdate,
): UpdateRecurringTimeComponentDto => ({
  ...toRecurringTimeComponentFields(component),
  id: component.id,
  recurringTimeSlots: component.recurringTimeSlots.map((slot) => ({
    ...toTimeSlot(slot),
    id: slot.id,
  })),
});

const toEventFields = (event: EventToCreate): EventFields => ({
  start: event.start ? fromPlainDateTimeToApiDateTime(event.start) : undefined,
  end: event.end ? fromPlainDateTimeToApiDateTime(event.end) : undefined,
});

const toChangesDto = (changes: ProjectChanges) => ({
  createdRecurringTimeComponents: changes.createdRecurringTimeComponents.map(
    toRecurringTimeComponentFields,
  ),
  updatedRecurringTimeComponents: changes.updatedRecurringTimeComponents.map(
    toUpdateRecurringTimeComponentDto,
  ),
  deletedRecurringTimeComponentIds: changes.deletedRecurringTimeComponentIds,
  createdEvents: changes.createdEvents.map(toEventFields),
  updatedEvents: changes.updatedEvents.map((event) => ({
    ...toEventFields(event),
    id: event.id,
  })),
  deletedEventIds: changes.deletedEventIds,
});

const asText = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

const asClearableText = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const asSet = <T>(value: T | null): T | undefined => value ?? undefined;

const toCreateProjectDto = (project: ProjectToCreate): CreateProjectDto => ({
  name: asText(project.name),
  goal: asText(project.goal),
  context: asText(project.context),

  projectStatus: project.projectStatus,
  projectType: project.projectType,

  timeNeededMinutes: asSet(project.timeNeededMinutes),
  minBlockMinutes: asSet(project.minBlockMinutes),
  repetitionsNeeded: asSet(project.repetitionsNeeded),

  earliestDate: project.earliestDate
    ? fromPlainDateToApiDate(project.earliestDate)
    : undefined,
  earliestTime: project.earliestTime
    ? fromPlainTimeToApiTime(project.earliestTime)
    : undefined,
  deadlineDate: project.deadlineDate
    ? fromPlainDateToApiDate(project.deadlineDate)
    : undefined,
  deadlineTime: project.deadlineTime
    ? fromPlainTimeToApiTime(project.deadlineTime)
    : undefined,

  originalTimezone: project.originalTimezone,

  parentProjectId: asSet(project.parentProjectId),
  colorId: asSet(project.colorId),

  recurringTimeComponents: project.recurringTimeComponents.map(
    toRecurringTimeComponentFields,
  ),
  events: project.events.map(toEventFields),
});

const toUpdateProjectDto = (project: ProjectToUpdate): UpdateProjectDto => ({
  id: project.id,

  name: asClearableText(project.name),
  goal: asClearableText(project.goal),
  context: asClearableText(project.context),

  projectType: project.projectType,

  timeNeededMinutes: project.timeNeededMinutes,
  minBlockMinutes: project.minBlockMinutes,
  repetitionsNeeded: project.repetitionsNeeded,

  earliestDate: project.earliestDate
    ? fromPlainDateToApiDate(project.earliestDate)
    : null,
  earliestTime: project.earliestTime
    ? fromPlainTimeToApiTime(project.earliestTime)
    : null,
  deadlineDate: project.deadlineDate
    ? fromPlainDateToApiDate(project.deadlineDate)
    : null,
  deadlineTime: project.deadlineTime
    ? fromPlainTimeToApiTime(project.deadlineTime)
    : null,

  colorId: project.colorId,

  ...toChangesDto(project),
});

const projectsQuery = {
  queryKey: PROJECTS_KEY,
  queryFn: async () =>
    (await apiClient.project.getProjectsByUser(getConnection())).projects,
  select: (projects: ProjectWithTimeSlots[]) => projects.map(toProject),
};

type Reorder = (
  projects: ProjectWithTimeSlots[],
  move: MoveProjectDto,
) => ProjectWithTimeSlots[];

const invalidateAfterProjectWrite = async () => {
  await queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
  await queryClient.invalidateQueries({ queryKey: COLORS_KEY });
  await queryClient.invalidateQueries({ queryKey: EVENTS_KEY });
};

const writeMoveToCache = async (reorder: Reorder, move: MoveProjectDto) => {
  await queryClient.cancelQueries({ queryKey: PROJECTS_KEY });

  const previous =
    queryClient.getQueryData<ProjectWithTimeSlots[]>(PROJECTS_KEY);

  queryClient.setQueryData<ProjectWithTimeSlots[]>(PROJECTS_KEY, (current) =>
    reorder(current ?? [], move),
  );

  return previous;
};

const movesInFlight = new Set<string>();
const movesPending = new Map<string, MoveProjectDto>();

export const projects = {
  getProjects: (): Promise<Project[]> =>
    queryClient.query({ ...projectsQuery, staleTime: 0 }),

  createProject: async (project: ProjectToCreate) => {
    try {
      return await apiClient.project.createProject(
        getConnection(),
        toCreateProjectDto(project),
      );
    } finally {
      await invalidateAfterProjectWrite();
    }
  },

  updateProject: async (project: ProjectToUpdate) => {
    try {
      return await apiClient.project.updateProject(
        getConnection(),
        toUpdateProjectDto(project),
      );
    } finally {
      await invalidateAfterProjectWrite();
    }
  },

  moveProject: async (move: MoveProjectDto, reorder: Reorder) => {
    const previous = await writeMoveToCache(reorder, move);
    const { id } = move;

    movesPending.set(id, move);
    if (movesInFlight.has(id)) return;

    movesInFlight.add(id);

    try {
      while (movesPending.has(id)) {
        const queued = movesPending.get(id) as MoveProjectDto;
        movesPending.delete(id);
        await apiClient.project.move.moveProject(getConnection(), queued);
      }
    } catch (error) {
      console.error('Move failed, restoring the list', error);
      if (previous) queryClient.setQueryData(PROJECTS_KEY, previous);
    } finally {
      movesInFlight.delete(id);
      movesPending.delete(id);
      await queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
    }
  },
};

export const useProjectsHotReload = (): Project[] =>
  useQuery(projectsQuery).data ?? [];
