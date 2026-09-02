import { ErrorCode } from '../system/errors/error.code';
import { ErrorType, PlatchError } from '../system/errors/platch.error';

export type ProjectStatus = 'ACTIVE' | 'BACKLOG';

/* Only the columns the ordering is made of. The planner is pure and knows
   nothing about Prisma, so it can be exercised on plain objects. */
export type ChainNode = {
  id: string;
  parentProjectId: string | null;
  projectStatus: ProjectStatus;
  prevProjectIdInHierarchy: string | null;
};

export type MoveRequest = {
  id: string;
  parentProjectId: string | null;
  /* The project this one should follow within its new chain; null puts it at
     the head. */
  prevProjectIdInHierarchy: string | null;
  /* Present only when the move crosses sections. The whole subtree follows. */
  projectStatus?: ProjectStatus;
};

export type ChainWrite = {
  id: string;
  prevProjectIdInHierarchy: string | null;
  parentProjectId?: string | null;
};

export type ChainPlan = {
  /* Every project whose status the move changes — the moved one and its whole
     subtree — so the caller can settle them in a single updateMany rather than
     one statement each. */
  statusChange: { ids: string[]; projectStatus: ProjectStatus } | null;
  /* Pointer and parent writes, in an order that is legal at every step. */
  writes: ChainWrite[];
};

const invalid = (message: string) =>
  new PlatchError({
    type: ErrorType.CLIENT_UNEXPECTED,
    code: ErrorCode.VALIDATION_FAILED,
    message,
  });

const groupKey = (parentProjectId: string | null, status: ProjectStatus) =>
  `${parentProjectId ?? 'root'}::${status}`;

/* The order of one chain, tolerant of the same corruption the client renders
   through: a group with no null head takes its lowest id as the head, several
   null heads run one after another, a cycle is cut, and whatever the walk never
   reaches is appended. A move must not fail because the data was already wrong,
   and the plan it produces leaves the group with exactly one head. */
const orderGroup = (members: ChainNode[]): ChainNode[] => {
  if (members.length < 2) return members;

  const ids = new Set(members.map((member) => member.id));
  const byPrev = new Map<string, ChainNode>();
  const heads: ChainNode[] = [];

  for (const member of members) {
    const prev = member.prevProjectIdInHierarchy;
    if (prev === null || !ids.has(prev)) heads.push(member);
    else byPrev.set(prev, member);
  }

  const byId = (a: ChainNode, b: ChainNode) => (a.id < b.id ? -1 : 1);
  const ordered: ChainNode[] = [];
  const seen = new Set<string>();

  const walkFrom = (start: ChainNode) => {
    let node: ChainNode | undefined = start;
    while (node && !seen.has(node.id)) {
      seen.add(node.id);
      ordered.push(node);
      node = byPrev.get(node.id);
    }
  };

  [...(heads.length > 0 ? heads : members)].sort(byId).forEach(walkFrom);
  members
    .filter((member) => !seen.has(member.id))
    .sort(byId)
    .forEach(walkFrom);

  return ordered;
};

/* A status change can merge two chains into one group: the children that were
   already in the destination section, and the ones that just arrived with the
   subtree. Ordering the merged group as a whole would settle it by the id
   tiebreak in orderGroup, which is arbitrary to anyone reading the list. The
   arriving chain is appended after the settled one instead, so the section the
   project moved into keeps the order it already had. */
const orderMerged = (
  members: ChainNode[],
  arriving: ReadonlySet<string>,
): ChainNode[] => {
  const settled = members.filter((member) => !arriving.has(member.id));
  const incoming = members.filter((member) => arriving.has(member.id));

  if (settled.length === 0 || incoming.length === 0) return orderGroup(members);

  return [...orderGroup(settled), ...orderGroup(incoming)];
};

const collectSubtree = (projects: ChainNode[], rootId: string): Set<string> => {
  const childrenOf = new Map<string, ChainNode[]>();
  for (const project of projects) {
    const parentId = project.parentProjectId;
    if (parentId === null) continue;
    const siblings = childrenOf.get(parentId);
    if (siblings) siblings.push(project);
    else childrenOf.set(parentId, [project]);
  }

  const subtree = new Set<string>();
  const queue = [rootId];

  while (queue.length > 0) {
    const id = queue.pop() as string;
    if (subtree.has(id)) continue;
    subtree.add(id);
    for (const child of childrenOf.get(id) ?? []) queue.push(child.id);
  }

  return subtree;
};

/**
 * Works out every write a move needs, and the order they are legal in.
 *
 * `prevProjectIdInHierarchy` is globally unique, so a pointer cannot be
 * reassigned while another row still claims it, and Prisma cannot declare the
 * constraint deferrable. Rather than reason about which particular pairs
 * collide, every row whose pointer changes is nulled first and set afterwards:
 * once the changing rows hold null, the only rows still holding a pointer are
 * the ones keeping it, and a final state where two rows share a predecessor is
 * corrupt input rather than something this could have caused.
 */
export const planChainWrites = (
  projects: ChainNode[],
  move: MoveRequest,
): ChainPlan => {
  const byId = new Map(projects.map((project) => [project.id, project]));

  const moved = byId.get(move.id);
  if (!moved) throw invalid('The project being moved does not exist.');

  const subtree = collectSubtree(projects, move.id);

  if (move.parentProjectId !== null) {
    if (!byId.has(move.parentProjectId)) {
      throw invalid('The new parent does not exist.');
    }
    /* Reparenting a project under its own descendant would cut that whole
       branch loose from the root, with nothing to render it. */
    if (subtree.has(move.parentProjectId)) {
      throw invalid('A project cannot be moved inside itself.');
    }
  }

  const status = move.projectStatus ?? moved.projectStatus;
  const isStatusChanging = status !== moved.projectStatus;

  if (move.prevProjectIdInHierarchy !== null) {
    const target = byId.get(move.prevProjectIdInHierarchy);
    if (!target) throw invalid('The project to follow does not exist.');
    if (subtree.has(target.id)) {
      throw invalid(
        'A project cannot be placed after itself or its own child.',
      );
    }
    if (
      target.parentProjectId !== move.parentProjectId ||
      target.projectStatus !== status
    ) {
      throw invalid('The project to follow is not in the destination list.');
    }
  }

  /* Not the whole subtree: a descendant already in the destination section did
     not arrive with the move, it was there first. Treating it as arriving would
     leave the merged group with no settled half to append behind, and the order
     would fall back to the id tiebreak. */
  const arriving = new Set(
    [...subtree].filter(
      (id) => (byId.get(id) as ChainNode).projectStatus !== status,
    ),
  );

  /* The state the move is aiming at, resolved before a single write is
     chosen. Everything below is bookkeeping to reach it legally. */
  const settled = new Map<string, ChainNode>(
    projects.map((project) => [
      project.id,
      subtree.has(project.id)
        ? { ...project, projectStatus: status }
        : { ...project },
    ]),
  );
  const movedSettled = settled.get(move.id) as ChainNode;
  movedSettled.parentProjectId = move.parentProjectId;

  const groups = new Map<string, ChainNode[]>();
  for (const project of settled.values()) {
    const key = groupKey(project.parentProjectId, project.projectStatus);
    const members = groups.get(key);
    if (members) members.push(project);
    else groups.set(key, [project]);
  }

  const targetKey = groupKey(move.parentProjectId, status);

  for (const [key, members] of groups) {
    /* The destination is threaded by hand so the request's position is
       honoured; every other group only has to come out with one head, which
       matters where a status change has merged two chains into one group. */
    const ordered =
      key === targetKey
        ? orderDestination(members, move)
        : orderMerged(members, arriving);

    ordered.forEach((project, index) => {
      project.prevProjectIdInHierarchy =
        index === 0 ? null : ordered[index - 1].id;
    });
  }

  const nulls: ChainWrite[] = [];
  const links: ChainWrite[] = [];

  for (const project of projects) {
    const target = settled.get(project.id) as ChainNode;
    const pointerChanged =
      target.prevProjectIdInHierarchy !== project.prevProjectIdInHierarchy;
    const parentChanged = target.parentProjectId !== project.parentProjectId;

    if (!pointerChanged && !parentChanged) continue;

    if (pointerChanged && project.prevProjectIdInHierarchy !== null) {
      nulls.push({ id: project.id, prevProjectIdInHierarchy: null });
    }

    links.push({
      id: project.id,
      prevProjectIdInHierarchy: target.prevProjectIdInHierarchy,
      ...(parentChanged ? { parentProjectId: target.parentProjectId } : {}),
    });
  }

  return {
    statusChange: isStatusChanging
      ? { ids: [...subtree], projectStatus: status }
      : null,
    writes: [...nulls, ...links],
  };
};

/* The destination keeps the order it already had, with the moved project lifted
   out and dropped back in where the request asked for it. */
const orderDestination = (
  members: ChainNode[],
  move: MoveRequest,
): ChainNode[] => {
  const others = orderGroup(members.filter((member) => member.id !== move.id));
  const moved = members.find((member) => member.id === move.id) as ChainNode;

  if (move.prevProjectIdInHierarchy === null) return [moved, ...others];

  const after = others.findIndex(
    (member) => member.id === move.prevProjectIdInHierarchy,
  );

  return [...others.slice(0, after + 1), moved, ...others.slice(after + 1)];
};
