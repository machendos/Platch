import type { MoveProjectDto } from '../../../../../api/structures/MoveProjectDto';
import type { ProjectWithTimeSlots } from '../../../../../api/structures/ProjectWithTimeSlots';

export const childrenOfProjectMap = (projects: ProjectWithTimeSlots[]) => {
  const childrenOf = new Map<string, string[]>();
  for (const project of projects) {
    if (project.parentProjectId === null) continue;
    const ids = childrenOf.get(project.parentProjectId);
    if (ids) ids.push(project.id);
    else childrenOf.set(project.parentProjectId, [project.id]);
  }

  return childrenOf;
};

export const collectDescendantIds = (
  projects: ProjectWithTimeSlots[],
  rootId: string,
) => {
  const childrenOf = childrenOfProjectMap(projects);

  const subtree = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.pop() as string;
    if (subtree.has(id)) continue;
    subtree.add(id);
    for (const child of childrenOf.get(id) ?? []) {
      queue.push(child);
    }
  }

  return subtree;
};

export const applyMove = (
  projects: ProjectWithTimeSlots[],
  move: MoveProjectDto,
): ProjectWithTimeSlots[] => {
  const moved = projects.find((project) => project.id === move.id);
  if (!moved) return projects;

  const status = move.projectStatus ?? moved.projectStatus;
  const subtree = collectDescendantIds(projects, move.id);

  return projects.map((project) => {
    if (project.id === move.id) {
      return {
        ...project,
        parentProjectId: move.parentProjectId,
        position: move.position,
        projectStatus: status,
      };
    }

    return subtree.has(project.id) && project.projectStatus !== status
      ? { ...project, projectStatus: status }
      : project;
  });
};
