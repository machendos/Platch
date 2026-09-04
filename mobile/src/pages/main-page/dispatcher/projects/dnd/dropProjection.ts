export type ProjectionRow = {
  id: string;
  depth: number;
};

export type Projection = {
  depth: number;
  parentProjectId: string | null;
  prevSiblingId: string | null;
  nextSiblingId: string | null;
};

export type ProjectionInput = {
  rows: ProjectionRow[];
  gapIndex: number;
  offsetX: number;
  indentStep: number;
  startDepth: number;
  previousDepth?: number;
};

const DEAD_BAND = 0.3;

const resolveDepth = ({
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

export const resolveDrop = (input: ProjectionInput): Projection => {
  const depth = resolveDepth(input);
  const above = input.rows.slice(0, input.gapIndex);

  const parent = [...above].reverse().find((row) => row.depth === depth - 1);
  const parentProjectId = depth === 0 ? null : (parent?.id ?? null);

  let prevSiblingId: string | null = null;
  for (let index = above.length - 1; index >= 0; index -= 1) {
    const row = above[index];
    if (row.depth < depth) break;
    if (row.depth === depth) {
      prevSiblingId = row.id;
      break;
    }
  }

  /* The row the drop lands in front of, which is what lets the server repair a
     key computed against positions it has since renumbered. The depth clamp
     never lets the drop sit shallower than the row below it, so that row is
     either the next sibling or the end of the group. */
  const below = input.rows[input.gapIndex];
  const nextSiblingId = below?.depth === depth ? below.id : null;

  return { depth, parentProjectId, prevSiblingId, nextSiblingId };
};
