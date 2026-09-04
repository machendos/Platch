import type { ProjectWithTimeSlots } from '../../../../api/structures/ProjectWithTimeSlots';

export type ProjectStatus = ProjectWithTimeSlots['projectStatus'];

export type ProjectRow = {
  project: ProjectWithTimeSlots;
  depth: number;
  isSpine: boolean;
  hasChildren: boolean;
  hexCode: string | null;
  ownsColor: boolean;
};

const sortProjectsByPosition = <T extends { id: string; position: string }>(
  items: T[],
) =>
  [...items].sort((left, right) =>
    left.position === right.position
      ? left.id.localeCompare(right.id)
      : left.position < right.position
        ? -1
        : 1,
  );

type Options = { collapsedIds?: ReadonlySet<string> };

export const buildSectionRows = (
  projects: ProjectWithTimeSlots[],
  status: ProjectStatus,
  { collapsedIds }: Options = {},
): ProjectRow[] => {
  const projectByIdMap = new Map(
    projects.map((project) => [project.id, project]),
  );

  const resolveParentId = (project: ProjectWithTimeSlots) => {
    const parentId = project.parentProjectId;
    if (parentId === null || parentId === project.id) return null;
    return projectByIdMap.has(parentId) ? parentId : null;
  };

  const childrenOf = new Map<string | null, ProjectWithTimeSlots[]>();
  for (const project of projects) {
    const parentId = resolveParentId(project);
    const siblings = childrenOf.get(parentId);
    if (siblings) siblings.push(project);
    else childrenOf.set(parentId, [project]);
  }

  const isMember = (project: ProjectWithTimeSlots) =>
    project.projectStatus === status;

  /* Not every project: the ones in this section, plus the ancestors needed to
     locate them, which render as spines. A project in the other section with
     nothing of this one beneath it never appears. Each walk up stops at the
     first id already collected, so shared ancestry is climbed once rather than
     once per descendant. */
  const idsToRender = new Set<string>();

  for (const project of projects) {
    if (!isMember(project)) continue;

    let id: string | null = project.id;

    while (id !== null && !idsToRender.has(id)) {
      idsToRender.add(id);
      const ancestor = projectByIdMap.get(id);
      id = ancestor ? resolveParentId(ancestor) : null;
    }
  }

  const rows: ProjectRow[] = [];

  /* Colour travels down with the walk rather than being resolved per row.
     Climbing to find the nearest coloured ancestor is O(depth) each time, which
     made a deep tree quadratic; the parent is always emitted first, so its
     resolved colour is simply handed to its children. */
  const emit = (
    parentId: string | null,
    depth: number,
    inheritedColorHex: string | null,
  ) => {
    const visible = (childrenOf.get(parentId) ?? []).filter((child) =>
      idsToRender.has(child.id),
    );
    if (visible.length === 0) return false;

    const members = sortProjectsByPosition(visible.filter(isMember));
    const spines = sortProjectsByPosition(
      visible.filter((child) => !isMember(child)),
    );

    for (const project of [...members, ...spines]) {
      const index = rows.length;
      const hexCode = project.color?.hexCode ?? inheritedColorHex;

      rows.push({
        project,
        depth,
        isSpine: !isMember(project),
        hasChildren: false,
        hexCode,
        ownsColor: project.color !== null,
      });

      if (collapsedIds?.has(project.id)) {
        rows[index].hasChildren = (childrenOf.get(project.id) ?? []).some(
          (child) => idsToRender.has(child.id),
        );
        continue;
      }

      rows[index].hasChildren = emit(project.id, depth + 1, hexCode);
    }

    return true;
  };

  emit(null, 0, null);

  return rows;
};

export const findMaxDepth = (rows: ProjectRow[]) =>
  rows.reduce((deepest, row) => Math.max(deepest, row.depth), 0);
