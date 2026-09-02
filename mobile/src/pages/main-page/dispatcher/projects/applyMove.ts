import type { ProjectWithTimeSlots } from '../../../../api/structures/ProjectWithTimeSlots';
import type { MoveProjectDto } from '../../../../api/structures/MoveProjectDto';

const descendantsOf = (projects: ProjectWithTimeSlots[], rootId: string) => {
  const childrenOf = new Map<string, string[]>();
  for (const project of projects) {
    if (project.parentProjectId === null) continue;
    const ids = childrenOf.get(project.parentProjectId);
    if (ids) ids.push(project.id);
    else childrenOf.set(project.parentProjectId, [project.id]);
  }

  const subtree = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.pop() as string;
    if (subtree.has(id)) continue;
    subtree.add(id);
    for (const child of childrenOf.get(id) ?? []) queue.push(child);
  }

  return subtree;
};

/**
 * The move applied locally, so the list settles under the finger instead of
 * after the round trip.
 *
 * This is deliberately the *simple* half of what the server does — unlink,
 * relink, carry the subtree's status — and not a second copy of the planner.
 * It has no unique index to work around, so it needs no write ordering, and it
 * does not attempt the chain splice a merged group needs. The refetch that
 * follows a successful move is what settles those cases, and until then the
 * only cost is that a merged list may reorder once when the truth arrives.
 */
export const applyMove = (
  projects: ProjectWithTimeSlots[],
  move: MoveProjectDto,
): ProjectWithTimeSlots[] => {
  const moved = projects.find((project) => project.id === move.id);
  if (!moved) return projects;

  const subtree = descendantsOf(projects, move.id);
  const status = move.projectStatus ?? moved.projectStatus;

  return projects.map((project) => {
    if (project.id === move.id) {
      return {
        ...project,
        parentProjectId: move.parentProjectId,
        prevProjectIdInHierarchy: move.prevProjectIdInHierarchy,
        projectStatus: status,
      };
    }

    /* The row that followed the moved project closes the gap it left. */
    if (project.prevProjectIdInHierarchy === move.id) {
      return {
        ...project,
        prevProjectIdInHierarchy: moved.prevProjectIdInHierarchy,
      };
    }

    /* The row that used to follow the moved project's new predecessor now
       follows the moved project instead. */
    if (
      move.prevProjectIdInHierarchy !== null &&
      project.prevProjectIdInHierarchy === move.prevProjectIdInHierarchy &&
      project.id !== move.id
    ) {
      return { ...project, prevProjectIdInHierarchy: move.id };
    }

    /* A project taken to another section takes its whole subtree with it. */
    if (subtree.has(project.id) && project.projectStatus !== status) {
      return { ...project, projectStatus: status };
    }

    return project;
  });
};
