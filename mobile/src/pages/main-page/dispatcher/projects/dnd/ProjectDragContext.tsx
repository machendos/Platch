import { createContext, useContext } from 'react';
import type { Projection } from './dropProjection';

export type DragState = {
  draggingId: string | null;
  hiddenIds: ReadonlySet<string>;
  projection: Projection | null;
  gapIndex: number | null;
  gapTop: number | null;
  section: string | null;
};

export const EMPTY_DRAG: DragState = {
  draggingId: null,
  hiddenIds: new Set(),
  projection: null,
  gapIndex: null,
  gapTop: null,
  section: null,
};

export const ProjectDragContext = createContext<DragState>(EMPTY_DRAG);

export const useProjectDrag = () => useContext(ProjectDragContext);
