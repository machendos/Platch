import type { ProjectWithTimeSlots } from '../../../../api/structures/ProjectWithTimeSlots';

export type ProjectStatus = ProjectWithTimeSlots['projectStatus'];

export type ProjectRow = {
  project: ProjectWithTimeSlots;
  depth: number;
  hasChildren: boolean;
  hexCode: string | null;
  ownsColor: boolean;
};

export const sortProjectsByPosition = <
  T extends { id: string; position: string },
>(
  items: T[],
) =>
  [...items].sort((left, right) =>
    left.position === right.position
      ? left.id.localeCompare(right.id)
      : left.position < right.position
        ? -1
        : 1,
  );

export type MemberTree = {
  memberById: Map<string, ProjectWithTimeSlots>;
  childrenOf: Map<string | null, ProjectWithTimeSlots[]>;
};

/* A section's projects and the edges between them, and nothing else. A parent
   in the other category reads as no parent at all, so its child renders at the
   top level rather than disappearing — the same treatment a missing parent
   already got. Moves keep parent and child in one category, so that fallback
   should never fire; it is here so bad data stays visible. */
export const buildMemberTree = (
  projects: ProjectWithTimeSlots[],
  status: ProjectStatus,
): MemberTree => {
  const memberById = new Map(
    projects
      .filter((project) => project.projectStatus === status)
      .map((project) => [project.id, project]),
  );

  const childrenOf = new Map<string | null, ProjectWithTimeSlots[]>();

  for (const project of memberById.values()) {
    const parentId = project.parentProjectId;
    const resolved =
      parentId !== null && parentId !== project.id && memberById.has(parentId)
        ? parentId
        : null;

    const siblings = childrenOf.get(resolved);
    if (siblings) siblings.push(project);
    else childrenOf.set(resolved, [project]);
  }

  return { memberById, childrenOf };
};

type Options = { collapsedIds?: ReadonlySet<string> };

export const buildSectionRows = (
  projects: ProjectWithTimeSlots[],
  status: ProjectStatus,
  { collapsedIds }: Options = {},
): ProjectRow[] => {
  const { childrenOf } = buildMemberTree(projects, status);

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
    const children = childrenOf.get(parentId) ?? [];
    if (children.length === 0) return false;

    for (const project of sortProjectsByPosition(children)) {
      const index = rows.length;
      const hexCode = project.color?.hexCode ?? inheritedColorHex;

      rows.push({
        project,
        depth,
        hasChildren: false,
        hexCode,
        ownsColor: project.color !== null,
      });

      if (collapsedIds?.has(project.id)) {
        rows[index].hasChildren = (childrenOf.get(project.id) ?? []).length > 0;
        continue;
      }

      rows[index].hasChildren = emit(project.id, depth + 1, hexCode);
    }

    return true;
  };

  emit(null, 0, null);

  return rows;
};
