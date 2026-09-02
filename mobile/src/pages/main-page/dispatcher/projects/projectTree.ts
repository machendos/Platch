import type { ProjectWithTimeSlots } from '../../../../api/structures/ProjectWithTimeSlots';

export type ProjectStatus = ProjectWithTimeSlots['projectStatus'];

export type ProjectRow = {
  project: ProjectWithTimeSlots;
  depth: number;
  /* An ancestor drawn only so its descendants can be located: its own status
     belongs to another section. It is one row of the same project, never a
     copy — see docs/dispatcher.md. */
  isSpine: boolean;
  hasChildren: boolean;
};

type Chainable = { id: string; prevProjectIdInHierarchy: string | null };

/* The order of one (parentProjectId, projectStatus) chain. The data can be
   corrupt in four ways and every one of them still has to render, so none of
   this throws: a chain with no null head takes its lowest id as the head,
   several null heads run one after another in id order, a cycle is cut by
   `seen`, and whatever the walk never reaches is appended in id order. */
const orderChain = <T extends Chainable>(siblings: T[]): T[] => {
  if (siblings.length < 2) return siblings;

  const byId = new Set(siblings.map((sibling) => sibling.id));
  const byPrev = new Map<string, T>();
  const heads: T[] = [];

  for (const sibling of siblings) {
    const prev = sibling.prevProjectIdInHierarchy;
    if (prev === null || !byId.has(prev)) heads.push(sibling);
    else byPrev.set(prev, sibling);
  }

  const byIdOrder = (a: T, b: T) => (a.id < b.id ? -1 : 1);
  const ordered: T[] = [];
  const seen = new Set<string>();

  const walkFrom = (start: T) => {
    let node: T | undefined = start;
    while (node && !seen.has(node.id)) {
      seen.add(node.id);
      ordered.push(node);
      node = byPrev.get(node.id);
    }
  };

  const starts = heads.length > 0 ? [...heads] : [...siblings];
  starts.sort(byIdOrder);
  starts.forEach(walkFrom);

  const stranded = siblings
    .filter((sibling) => !seen.has(sibling.id))
    .sort(byIdOrder);
  stranded.forEach(walkFrom);

  return ordered;
};

/* Keyed on what is collapsed, not on what is expanded: a project's children
   show by default, so the set holds exceptions. An expanded-keyed set would
   have to be seeded with every id and resynced whenever projects load. */
type Options = { collapsedIds?: ReadonlySet<string> };

export const buildSectionRows = (
  projects: ProjectWithTimeSlots[],
  status: ProjectStatus,
  { collapsedIds }: Options = {},
): ProjectRow[] => {
  const byId = new Map(projects.map((project) => [project.id, project]));

  /* A parent that does not exist, or that is the project itself, would make
     the walk unreachable or infinite. Both read as a root instead. */
  const parentOf = (project: ProjectWithTimeSlots) => {
    const parentId = project.parentProjectId;
    if (parentId === null || parentId === project.id) return null;
    return byId.has(parentId) ? parentId : null;
  };

  const childrenOf = new Map<string | null, ProjectWithTimeSlots[]>();
  for (const project of projects) {
    const parentId = parentOf(project);
    const siblings = childrenOf.get(parentId);
    if (siblings) siblings.push(project);
    else childrenOf.set(parentId, [project]);
  }

  const isMember = (project: ProjectWithTimeSlots) =>
    project.projectStatus === status;

  /* A node earns a row when it is in this section, or when it stands between
     the root and something that is. */
  const shown = new Set<string>();
  for (const project of projects) {
    if (!isMember(project)) continue;

    let id: string | null = project.id;
    while (id !== null && !shown.has(id)) {
      shown.add(id);
      const node = byId.get(id);
      id = node ? parentOf(node) : null;
    }
  }

  const rows: ProjectRow[] = [];

  const emit = (parentId: string | null, depth: number) => {
    const visible = (childrenOf.get(parentId) ?? []).filter((child) =>
      shown.has(child.id),
    );
    if (visible.length === 0) return false;

    /* Members first in their own chain order, then spines in theirs. Two
       independent chains have no interleaving anyone could predict, so the
       spines follow rather than mix in. */
    const members = orderChain(visible.filter(isMember));
    const spines = orderChain(visible.filter((child) => !isMember(child)));

    for (const project of [...members, ...spines]) {
      const index = rows.length;
      rows.push({
        project,
        depth,
        isSpine: !isMember(project),
        hasChildren: false,
      });

      if (collapsedIds?.has(project.id)) {
        rows[index].hasChildren = (childrenOf.get(project.id) ?? []).some(
          (child) => shown.has(child.id),
        );
        continue;
      }

      rows[index].hasChildren = emit(project.id, depth + 1);
    }

    return true;
  };

  emit(null, 0);

  return rows;
};

export const maxDepth = (rows: ProjectRow[]) =>
  rows.reduce((deepest, row) => Math.max(deepest, row.depth), 0);
