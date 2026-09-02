import type { BreadcrumbItem } from './Breadcrumbs';

export type ProjectCrumb = {
  id: string;
  name: string;
  parentProjectId: string | null;
};

export const buildAncestry = (
  projects: ProjectCrumb[],
  parentProjectId: string | null,
): BreadcrumbItem[] => {
  const byId = new Map(projects.map((project) => [project.id, project]));
  const seen = new Set<string>();
  const path: BreadcrumbItem[] = [];

  let id = parentProjectId;

  while (id !== null && !seen.has(id)) {
    const project = byId.get(id);
    if (!project) break;

    seen.add(id);
    path.push({ id: project.id, label: project.name });
    id = project.parentProjectId;
  }

  return path.reverse();
};
