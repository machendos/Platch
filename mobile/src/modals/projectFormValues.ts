import type { Project, ProjectTarget } from '../api/project';
import type { ProjectStatus } from './components/projectStatusSwitch/ProjectStatusSwitch';
import type { ProjectType } from './components/projectTypeSwitch/ProjectTypeSwitch';

export type ProjectFormValues = {
  name: string;
  goal: string;
  context: string;
  status: ProjectStatus;
  type: ProjectType;
  colorId: string | null;
};

export const toProjectFormValues = (project: Project): ProjectFormValues => ({
  name: project.name ?? '',
  goal: project.goal ?? '',
  context: project.context ?? '',
  status: project.projectStatus as ProjectStatus,
  type: project.projectType as ProjectType,
  colorId: project.colorId,
});

export const toProjectTarget = (project: Project): ProjectTarget => ({
  timeNeededMinutes: project.timeNeededMinutes,
  minBlockMinutes: project.minBlockMinutes,
  repetitionsNeeded: project.repetitionsNeeded,

  earliestDate: project.earliestDate,
  earliestTime: project.earliestTime,
  deadlineDate: project.deadlineDate,
  deadlineTime: project.deadlineTime,
});
