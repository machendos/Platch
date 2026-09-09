import type { CreateProjectDto } from '../api/structures/CreateProjectDto';
import type { ProjectWithTimeSlots } from '../api/structures/ProjectWithTimeSlots';
import type { TimeComponentFields } from '../api/structures/TimeComponentFields';
import type { UpdateProjectDto } from '../api/structures/UpdateProjectDto';
import { parseApiDateTime } from '../system/helpers/dateTimeSerializers';
import type { ProjectStatus } from './components/projectStatusSwitch/ProjectStatusSwitch';
import type { ProjectType } from './components/projectTypeSwitch/ProjectTypeSwitch';
import type { TargetDraft } from './components/targetComponent/targetState';
import type { TimeComponentsChanges } from './components/timeComponents/timeComponentsState';

export type ProjectFormValues = {
  name: string;
  goal: string;
  context: string;
  status: ProjectStatus;
  type: ProjectType;
  colorId: string | null;
};

type CreateInput = {
  values: ProjectFormValues;
  target: TargetDraft;
  timeComponents: TimeComponentFields[];
  parentProjectId: string | null;
  timeZone: string;
};

type UpdateInput = {
  id: string;
  values: ProjectFormValues;
  target: TargetDraft;
  timeComponentsChanges: TimeComponentsChanges;
};

const text = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

const clearable = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const set = <T>(value: T | null): T | undefined => value ?? undefined;

export const buildCreateProjectDto = ({
  values,
  target,
  timeComponents,
  parentProjectId,
  timeZone,
}: CreateInput): CreateProjectDto => ({
  name: text(values.name),
  goal: text(values.goal),
  context: text(values.context),

  projectStatus: values.status,
  projectType: values.type,

  timeNeededMinutes: set(target.timeNeededMinutes),
  minBlockMinutes: set(target.minBlockMinutes),
  repetitionsNeeded: set(target.repetitionsNeeded),

  earliestDate: target.earliestDate?.toString(),
  earliestTime: target.earliestTime?.toString(),
  deadlineDate: target.deadlineDate?.toString(),
  deadlineTime: target.deadlineTime?.toString(),

  originalTimezone: timeZone,

  parentProjectId: set(parentProjectId),
  colorId: set(values.colorId),

  timeComponents,
});

export const buildUpdateProjectDto = ({
  id,
  values,
  target,
  timeComponentsChanges,
}: UpdateInput): UpdateProjectDto => ({
  id,

  name: clearable(values.name),
  goal: clearable(values.goal),
  context: clearable(values.context),

  projectType: values.type,

  timeNeededMinutes: target.timeNeededMinutes,
  minBlockMinutes: target.minBlockMinutes,
  repetitionsNeeded: target.repetitionsNeeded,

  earliestDate: target.earliestDate?.toString() ?? null,
  earliestTime: target.earliestTime?.toString() ?? null,
  deadlineDate: target.deadlineDate?.toString() ?? null,
  deadlineTime: target.deadlineTime?.toString() ?? null,

  colorId: values.colorId,

  createdTimeComponents: timeComponentsChanges.createdTimeComponents,
  updatedTimeComponents: timeComponentsChanges.updatedTimeComponents,
  deletedTimeComponentIds: timeComponentsChanges.deletedTimeComponentIds,
});

export const toProjectFormValues = (
  project: ProjectWithTimeSlots,
): ProjectFormValues => ({
  name: project.name ?? '',
  goal: project.goal ?? '',
  context: project.context ?? '',
  status: project.projectStatus as ProjectStatus,
  type: project.projectType as ProjectType,
  colorId: project.colorId,
});

export const toTargetDraft = (project: ProjectWithTimeSlots): TargetDraft => ({
  timeNeededMinutes: project.timeNeededMinutes,
  minBlockMinutes: project.minBlockMinutes,
  repetitionsNeeded: project.repetitionsNeeded,

  earliestDate: project.earliestDate
    ? parseApiDateTime(project.earliestDate).toPlainDate()
    : null,
  earliestTime: project.earliestTime
    ? parseApiDateTime(project.earliestTime).toPlainTime()
    : null,
  deadlineDate: project.deadlineDate
    ? parseApiDateTime(project.deadlineDate).toPlainDate()
    : null,
  deadlineTime: project.deadlineTime
    ? parseApiDateTime(project.deadlineTime).toPlainTime()
    : null,
});
