import type { ProjectWithTimeSlots } from "./ProjectWithTimeSlots";

export type ProjectsSnapshot = {
  version: number;
  projects: ProjectWithTimeSlots[];
};
