import { createContext, useContext } from 'react';
import type { Projection } from './dropProjection';

export type DragState = {
  /* The project being dragged, and everything under it — those rows are hidden
     while it moves, because a project cannot land inside itself. */
  draggingId: string | null;
  hiddenIds: ReadonlySet<string>;
  /* Where it would land if the finger lifted now. The consequence line reads
     this, so what is drawn and what gets sent are the same value. */
  projection: Projection | null;
  /* Index in the section's rendered rows the line sits above; null when the
     drag is not over this section. */
  gapIndex: number | null;
  section: string | null;
};

export const EMPTY_DRAG: DragState = {
  draggingId: null,
  hiddenIds: new Set(),
  projection: null,
  gapIndex: null,
  section: null,
};

export const ProjectDragContext = createContext<DragState>(EMPTY_DRAG);

export const useProjectDrag = () => useContext(ProjectDragContext);
