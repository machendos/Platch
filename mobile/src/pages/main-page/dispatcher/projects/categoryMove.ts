import { generateKeyBetween } from 'fractional-indexing';
import type { MoveProjectDto } from '../../../../api/structures/MoveProjectDto';
import type { ProjectWithTimeSlots } from '../../../../api/structures/ProjectWithTimeSlots';
import type { ProjectStatus } from './projectTree';
import { buildMemberTree, sortProjectsByPosition } from './projectTree';

/* The raw name, never the rendered one: `projectName` shows an unnamed project
   as "(no name)", and matching on that would make every unnamed project match
   every other. Blank counts as unnamed — an empty string is reachable. */
const matchKey = (name: string | null) => {
  const trimmed = name?.trim();
  return trimmed ? trimmed.toLowerCase() : null;
};

/* Only ancestors in the category being left, which is the ancestry the user can
   actually see there. A project whose parent sits in the other category renders
   at the top level, so it should be matched as a top-level project too. */
const buildAncestorNames = (
  projects: ProjectWithTimeSlots[],
  project: ProjectWithTimeSlots,
) => {
  const byId = new Map(projects.map((candidate) => [candidate.id, candidate]));
  const seen = new Set<string>();
  const names: (string | null)[] = [];

  let id = project.parentProjectId;

  while (id !== null && !seen.has(id)) {
    seen.add(id);

    const ancestor = byId.get(id);
    if (!ancestor || ancestor.projectStatus !== project.projectStatus) break;

    names.push(matchKey(ancestor.name));
    id = ancestor.parentProjectId;
  }

  return names.reverse();
};

/* Walks down greedily rather than searching for the deepest match anywhere.
   With two same-named candidates the first by position wins and the descent
   stops there, even if the other branch would have matched one level deeper —
   that is predictable from the screen, which an exhaustive search would not be. */
const findDestinationParent = (
  tree: ReturnType<typeof buildMemberTree>,
  ancestorNames: (string | null)[],
) => {
  let parentId: string | null = null;

  for (const name of ancestorNames) {
    if (name === null) break;

    const match: ProjectWithTimeSlots | undefined = sortProjectsByPosition(
      tree.childrenOf.get(parentId) ?? [],
    ).find((candidate) => matchKey(candidate.name) === name);

    if (!match) break;

    parentId = match.id;
  }

  return parentId;
};

/* Where a project lands when the user asks for the other category without
   saying where. Its ancestry in the category it is leaving is matched by name
   against the category it is entering, and it lands as the first child of the
   deepest node that matches. No match at all means the top of the root.

   Not its own inverse: moving back finds no matching ancestry unless the two
   categories mirror each other, so the project returns to the root rather than
   to where it started. */
export const resolveCategoryMove = (
  projects: ProjectWithTimeSlots[],
  project: ProjectWithTimeSlots,
  targetStatus: ProjectStatus,
): MoveProjectDto => {
  const tree = buildMemberTree(projects, targetStatus);
  const parentProjectId = findDestinationParent(
    tree,
    buildAncestorNames(projects, project),
  );

  const firstChild = sortProjectsByPosition(
    tree.childrenOf.get(parentProjectId) ?? [],
  ).at(0);

  return {
    id: project.id,
    parentProjectId,
    position: generateKeyBetween(null, firstChild?.position ?? null),
    prevSiblingId: null,
    nextSiblingId: firstChild?.id ?? null,
    projectStatus: targetStatus,
  };
};

export const otherCategory = (status: ProjectStatus): ProjectStatus =>
  status === 'ACTIVE' ? 'BACKLOG' : 'ACTIVE';
