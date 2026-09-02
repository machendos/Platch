export type ProjectionRow = {
  id: string;
  depth: number;
};

export type Projection = {
  depth: number;
  parentProjectId: string | null;
  prevProjectIdInHierarchy: string | null;
};

export type ProjectionInput = {
  /* The visible rows with the dragged project and its subtree taken out, since
     a project cannot land inside itself. */
  rows: ProjectionRow[];
  /* Where the dragged row would sit: 0 puts it above everything, rows.length
     below everything. */
  gapIndex: number;
  /* How far the pointer has travelled sideways since the drag began. */
  offsetX: number;
  indentStep: number;
  /* The depth the project had when the drag started, which is what the offset
     is measured from. */
  startDepth: number;
  /* What the last frame settled on. Without it the depth flips back and forth
     while the finger sits on a boundary. */
  previousDepth?: number;
};

/* How far past the halfway point the pointer has to travel before the depth
   changes, as a fraction of one indent step. Nothing about a finger is steady
   enough for a bare rounding boundary. */
const DEAD_BAND = 0.3;

/* Vertical position picks the gap; this picks the depth inside it. Drag right
   to become a child of the row above, left to climb back out towards the root.
   The range is bounded at both ends: you can never nest under nothing, and
   never leave a gap the row below could not still be a child of. */
const projectDepth = ({
  rows,
  gapIndex,
  offsetX,
  indentStep,
  startDepth,
  previousDepth,
}: ProjectionInput) => {
  const above = rows[gapIndex - 1];
  const below = rows[gapIndex];

  const maxDepth = above ? above.depth + 1 : 0;
  const minDepth = below ? below.depth : 0;

  const wanted = startDepth + offsetX / indentStep;

  const settled =
    previousDepth === undefined
      ? Math.round(wanted)
      : wanted > previousDepth + 0.5 + DEAD_BAND
        ? Math.ceil(wanted - 0.5 - DEAD_BAND)
        : wanted < previousDepth - 0.5 - DEAD_BAND
          ? Math.floor(wanted + 0.5 + DEAD_BAND)
          : previousDepth;

  return Math.min(Math.max(settled, minDepth), maxDepth);
};

/**
 * Turns a drop — a gap between two rows, and how far the pointer drifted
 * sideways — into the parent and predecessor the move endpoint needs.
 *
 * Both come from the rows above the gap: the parent is the nearest one a level
 * shallower, and the predecessor is the nearest one at the same level under
 * that same parent. Reading them off the rendered list rather than recomputing
 * the tree means what the consequence line drew and what gets sent cannot
 * disagree.
 */
export const projectDrop = (input: ProjectionInput): Projection => {
  const depth = projectDepth(input);
  const above = input.rows.slice(0, input.gapIndex);

  const parent = [...above].reverse().find((row) => row.depth === depth - 1);
  const parentProjectId = depth === 0 ? null : (parent?.id ?? null);

  /* Walking back past anything deeper — those are the parent's other
     descendants, not candidates to follow. The first row shallower than this
     one ends the search: it is the parent, so nothing before it is a sibling. */
  let prevProjectIdInHierarchy: string | null = null;
  for (let index = above.length - 1; index >= 0; index -= 1) {
    const row = above[index];
    if (row.depth < depth) break;
    if (row.depth === depth) {
      prevProjectIdInHierarchy = row.id;
      break;
    }
  }

  return { depth, parentProjectId, prevProjectIdInHierarchy };
};
