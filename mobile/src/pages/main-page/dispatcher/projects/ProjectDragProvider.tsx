import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { DragDropProvider, PointerSensor } from '@dnd-kit/react';
import { PointerActivationConstraints } from '@dnd-kit/dom';
import { isSortable } from '@dnd-kit/react/sortable';
import type { MoveProjectDto } from '../../../../api/structures/MoveProjectDto';
import type { ProjectWithTimeSlots } from '../../../../api/structures/ProjectWithTimeSlots';
import { PROJECT_INDENT_STEP } from '../../layout-config';
import { buildSectionRows } from './projectTree';
import type { ProjectStatus } from './projectTree';
import { projectDrop } from './dropProjection';
import type { Projection } from './dropProjection';
import { EMPTY_DRAG, ProjectDragContext } from './ProjectDragContext';
import type { DragState } from './ProjectDragContext';

type ProjectDragProviderProps = {
  projects: ProjectWithTimeSlots[];
  onMove: (dto: MoveProjectDto) => Promise<void>;
  children: ReactNode;
};

/* Long-press on touch, immediate on mouse. The delay is what leaves a vertical
   pan free to scroll the section and a horizontal one free to swipe the row;
   the tolerance cancels the pending drag the moment the finger travels, so a
   swipe never turns into a drag by accident. On a mouse there is no gesture to
   share with, so a few pixels of travel is enough. */
const sensors = [
  PointerSensor.configure({
    activationConstraints: [
      new PointerActivationConstraints.Delay({ value: 250, tolerance: 8 }),
      new PointerActivationConstraints.Distance({ value: 4 }),
    ],
  }),
];

const descendantsOf = (projects: ProjectWithTimeSlots[], rootId: string) => {
  const childrenOf = new Map<string, string[]>();
  for (const project of projects) {
    if (project.parentProjectId === null) continue;
    const ids = childrenOf.get(project.parentProjectId);
    if (ids) ids.push(project.id);
    else childrenOf.set(project.parentProjectId, [project.id]);
  }

  const subtree = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.pop() as string;
    if (subtree.has(id)) continue;
    subtree.add(id);
    for (const child of childrenOf.get(id) ?? []) queue.push(child);
  }

  return subtree;
};

export const ProjectDragProvider = ({
  projects,
  onMove,
  children,
}: ProjectDragProviderProps) => {
  const [drag, setDrag] = useState<DragState>(EMPTY_DRAG);

  /* The projection is read back on the next move to hold its depth steady, and
     again on drop to send exactly what the line drew. A ref rather than state
     because it is written on every pointer move. */
  const latest = useRef<{
    id: string | null;
    projection: Projection | null;
    section: ProjectStatus | null;
    /* Kept because the depth has to follow sideways movement too, and that
       arrives as onDragMove — which reports no target, only a transform. */
    gapIndex: number | null;
  }>({ id: null, projection: null, section: null, gapIndex: null });
  const startDepth = useRef(0);

  const rowsFor = useMemo(
    () => (status: ProjectStatus) => buildSectionRows(projects, status),
    [projects],
  );

  const begin = (id: string) => {
    const project = projects.find((candidate) => candidate.id === id);
    if (!project) return;

    /* Descendants only. The dragged row itself stays mounted: it is dnd-kit's
       drag source, and unmounting it mid-drag takes its sortable registration
       with it, after which every collision resolves back to nothing. */
    const hiddenIds = descendantsOf(projects, id);
    hiddenIds.delete(id);
    const rows = rowsFor(project.projectStatus);
    startDepth.current = rows.find((row) => row.project.id === id)?.depth ?? 0;

    /* Seeded from where the project already sits, so a drag that never leaves
       its own row still has a section and a gap to measure against. Without
       this a purely sideways gesture — the one that changes a parent — has
       nothing to report, because onDragOver only speaks when the row under the
       finger changes. */
    const section = project.projectStatus;
    const gapIndex = rows
      .filter((row) => !hiddenIds.has(row.project.id))
      .findIndex((row) => row.project.id === id);

    latest.current = { id, projection: null, section, gapIndex };
    setDrag({
      draggingId: id,
      hiddenIds,
      projection: null,
      gapIndex: null,
      section,
    });
  };

  const update = (
    section: ProjectStatus,
    gapIndex: number,
    offsetX: number,
    hiddenIds: ReadonlySet<string>,
  ) => {
    const rendered = rowsFor(section)
      .filter((row) => !hiddenIds.has(row.project.id))
      .map((row) => ({ id: row.project.id, depth: row.depth }));

    /* dnd-kit's index counts the rendered list, which still holds the dragged
       row. The projection must not see it — a project cannot follow itself —
       so it comes out here, and the gap shifts back with it. */
    const draggedAt = rendered.findIndex((row) => row.id === latest.current.id);
    const rows =
      draggedAt === -1
        ? rendered
        : [...rendered.slice(0, draggedAt), ...rendered.slice(draggedAt + 1)];
    const gap =
      draggedAt !== -1 && gapIndex > draggedAt ? gapIndex - 1 : gapIndex;

    const projection = projectDrop({
      rows,
      gapIndex: gap,
      offsetX,
      indentStep: PROJECT_INDENT_STEP,
      startDepth: startDepth.current,
      previousDepth:
        latest.current.section === section
          ? latest.current.projection?.depth
          : undefined,
    });

    latest.current = { ...latest.current, projection, section, gapIndex };
    setDrag((current) => ({ ...current, projection, gapIndex, section }));
  };

  const finish = async () => {
    /* Read from the ref, not from state: dnd-kit holds the handler it was given
       when the drag began, and a closure over state would still be reporting
       the list as it was before the finger moved. */
    const { id, projection, section } = latest.current;

    setDrag(EMPTY_DRAG);
    latest.current = {
      id: null,
      projection: null,
      section: null,
      gapIndex: null,
    };

    if (!id || !projection || !section) return;

    const project = projects.find((candidate) => candidate.id === id);
    if (!project) return;

    const dto: MoveProjectDto = {
      id,
      parentProjectId: projection.parentProjectId,
      prevProjectIdInHierarchy: projection.prevProjectIdInHierarchy,
      /* Only sent when the section actually changes: the field is what tells
         the server to carry the subtree across. */
      ...(section === project.projectStatus ? {} : { projectStatus: section }),
    };

    /* Nothing to do if it landed exactly where it started. */
    if (
      dto.parentProjectId === project.parentProjectId &&
      dto.prevProjectIdInHierarchy === project.prevProjectIdInHierarchy &&
      dto.projectStatus === undefined
    ) {
      return;
    }

    await onMove(dto);
  };

  return (
    <DragDropProvider
      sensors={sensors}
      onDragStart={(event) => begin(String(event.operation.source?.id))}
      onDragOver={(event) => {
        const { target } = event.operation;
        /* Only a sortable row reports which section it belongs to and where it
           sits in it, which is what the projection is measured against. */
        if (!isSortable(target)) return;

        update(
          target.group as ProjectStatus,
          target.index,
          event.operation.transform.x,
          drag.hiddenIds,
        );
      }}
      /* onDragOver only fires when the row under the finger changes, so on its
         own the depth could never follow a purely sideways drag — which is the
         whole gesture for choosing a parent. onDragMove carries every frame. */
      onDragMove={(event) => {
        const { section, gapIndex } = latest.current;
        if (section === null || gapIndex === null) return;

        update(section, gapIndex, event.operation.transform.x, drag.hiddenIds);
      }}
      onDragEnd={() => {
        void finish();
      }}
    >
      <ProjectDragContext.Provider value={drag}>
        {children}
      </ProjectDragContext.Provider>
    </DragDropProvider>
  );
};
