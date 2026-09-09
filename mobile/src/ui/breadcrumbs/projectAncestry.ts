export type ProjectCrumb = {
  id: string;
  name: string | null;
  parentProjectId: string | null;
  colorId?: string | null;
};

/* Walks a project's ancestors, nearest parent first, so one walk answers
   everything inherited down the tree — the breadcrumb path and the colour a
   project takes from above are both read off the same result.

   Generic so the caller gets its own records back rather than a narrowed
   crumb. `seen` is not tidiness: a corrupt `parentProjectId` cycle would hang
   the render, and a parent missing from the list is what a partially loaded
   list looks like. */
export const ancestorsOf = <T extends ProjectCrumb>(
  projects: T[],
  parentProjectId: string | null,
): T[] => {
  const byId = new Map(projects.map((project) => [project.id, project]));
  const seen = new Set<string>();
  const path: T[] = [];

  let id = parentProjectId;

  while (id !== null && !seen.has(id)) {
    const project = byId.get(id);
    if (!project) break;

    seen.add(id);
    path.push(project);
    id = project.parentProjectId;
  }

  return path;
};
