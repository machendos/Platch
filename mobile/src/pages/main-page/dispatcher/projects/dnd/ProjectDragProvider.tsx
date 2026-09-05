import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { DragDropProvider, PointerSensor } from '@dnd-kit/react';
import { Feedback, PointerActivationConstraints } from '@dnd-kit/dom';
import { isSortable } from '@dnd-kit/react/sortable';
import type { MoveProjectDto } from '../../../../../api/structures/MoveProjectDto';
import type { ProjectWithTimeSlots } from '../../../../../api/structures/ProjectWithTimeSlots';
import {
  PROJECT_DROP_GAP,
  PROJECT_INDENT_STEP,
  PROJECT_ROW_GAP,
  PROJECT_ROW_MIN_HEIGHT,
} from '../../../layout-config';
import { generateKeyBetween } from 'fractional-indexing';
import { buildSectionRows } from '../projectTree';
import type { ProjectStatus } from '../projectTree';
import { collectDescendantIds } from './applyMove';
import { resolveDrop } from './dropProjection';
import type { Projection } from './dropProjection';
import { traceDrop } from './dropTrace';
import { EMPTY_DRAG, ProjectDragContext } from './ProjectDragContext';
import type { DragState } from './ProjectDragContext';

type ProjectDragProviderProps = {
  projects: ProjectWithTimeSlots[];
  onMove: (dto: MoveProjectDto) => void;
  onDropped: (id: string) => void;
  children: ReactNode;
};

const sensors = [
  PointerSensor.configure({
    activationConstraints: (event) =>
      event.pointerType === 'mouse'
        ? [new PointerActivationConstraints.Distance({ value: 4 })]
        : [
            new PointerActivationConstraints.Delay({
              value: 250,
              tolerance: 8,
            }),
          ],
  }),
];

/* Ordered the way the list orders itself, ties on id included. Comparing keys
   alone reports no predecessor whenever two siblings share one, which reads as
   "nothing moved" and swallows the move. */
const precedes = (left: ProjectWithTimeSlots, right: ProjectWithTimeSlots) =>
  left.position === right.position
    ? left.id.localeCompare(right.id) < 0
    : left.position < right.position;

const findPreviousSibling = (
  projects: ProjectWithTimeSlots[],
  project: ProjectWithTimeSlots,
) =>
  projects
    .filter(
      (candidate) =>
        candidate.parentProjectId === project.parentProjectId &&
        candidate.projectStatus === project.projectStatus &&
        precedes(candidate, project),
    )
    .sort((left, right) => (precedes(left, right) ? -1 : 1))
    .at(-1);


export const ProjectDragProvider = ({
  projects,
  onMove,
  onDropped,
  children,
}: ProjectDragProviderProps) => {
  const [drag, setDrag] = useState<DragState>(EMPTY_DRAG);

  const latest = useRef<{
    id: string | null;
    projection: Projection | null;
    section: ProjectStatus | null;
    gapIndex: number | null;
  }>({ id: null, projection: null, section: null, gapIndex: null });
  const startDepth = useRef(0);

  const pointerY = useRef(0);

  useEffect(() => {
    const track = (event: PointerEvent) => {
      pointerY.current = event.clientY;
    };

    document.addEventListener('pointerdown', track, { passive: true });
    document.addEventListener('pointermove', track, { passive: true });

    return () => {
      document.removeEventListener('pointerdown', track);
      document.removeEventListener('pointermove', track);
    };
  }, []);

  const buildRowsForSection = useMemo(
    () => (status: ProjectStatus) => buildSectionRows(projects, status),
    [projects],
  );

  const begin = (id: string) => {
    const project = projects.find((candidate) => candidate.id === id);
    if (!project) return;

    const hiddenIds = collectDescendantIds(projects, id);
    hiddenIds.delete(id);
    const rows = buildRowsForSection(project.projectStatus);
    startDepth.current = rows.find((row) => row.project.id === id)?.depth ?? 0;

    const section = project.projectStatus;
    const landable = rows.filter(
      (row) => !hiddenIds.has(row.project.id) && row.project.id !== id,
    );
    const ownIndex = rows.findIndex((row) => row.project.id === id);
    const gapIndex = landable.filter(
      (row) =>
        rows.findIndex((r) => r.project.id === row.project.id) < ownIndex,
    ).length;

    latest.current = { id, projection: null, section, gapIndex };
    setDrag({
      draggingId: id,
      hiddenIds,
      projection: null,
      gapIndex: null,
      gapTop: null,
      section,
    });
  };

  const readSection = (section: ProjectStatus, pointerY: number) => {
    const list = document.querySelector(
      `.project-list[data-section="${section}"]`,
    );
    if (!list) return { rows: [], gapIndex: 0, gapTop: 0 };

    /* dnd-kit's attributes, not our classes. It clones the row to make the
       placeholder before React has re-rendered the drag class onto the source,
       so the clone never carries it and counts as a real row here — which put
       the gap up to two positions below the pointer. */
    const elements = [...list.querySelectorAll('.project-row')].filter(
      (row) =>
        !row.hasAttribute('data-dnd-placeholder') &&
        row.getAttribute('data-dnd-dragging') !== 'true',
    );

    const above = elements.filter((row) => {
      const box = row.getBoundingClientRect();
      return box.top + box.height / 2 < pointerY;
    });

    const step = PROJECT_ROW_MIN_HEIGHT + PROJECT_ROW_GAP;
    const gapTop =
      above.length === 0
        ? PROJECT_DROP_GAP / 2
        : above.length * step -
          PROJECT_ROW_GAP +
          (PROJECT_ROW_GAP + PROJECT_DROP_GAP) / 2;

    return {
      rows: elements.map((row) => ({
        id: row.getAttribute('data-project-id') ?? '',
        depth: Number(row.getAttribute('data-depth') ?? 0),
      })),
      gapIndex: above.length,
      gapTop,
    };
  };

  const update = (
    section: ProjectStatus,
    pointerAt: number,
    offsetX: number,
  ) => {
    const { rows, gapIndex, gapTop } = readSection(section, pointerAt);

    const projection = resolveDrop({
      rows,
      gapIndex,
      offsetX,
      indentStep: PROJECT_INDENT_STEP,
      startDepth: startDepth.current,
      previousDepth:
        latest.current.section === section
          ? latest.current.projection?.depth
          : undefined,
    });

    latest.current = { ...latest.current, projection, section, gapIndex };
    setDrag((current) => ({
      ...current,
      projection,
      gapIndex,
      gapTop,
      section,
    }));
  };

  const finish = () => {
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

    const findSiblingPosition = (siblingId: string | null) =>
      siblingId === null
        ? null
        : (projects.find((candidate) => candidate.id === siblingId)?.position ??
          null);

    /* Computed here rather than while dragging, so a group the server
       renumbered mid-drag is keyed off what we now know rather than what the
       gap looked like when the finger passed over it. */
    const dto: MoveProjectDto = {
      id,
      parentProjectId: projection.parentProjectId,
      position: generateKeyBetween(
        findSiblingPosition(projection.prevSiblingId),
        findSiblingPosition(projection.nextSiblingId),
      ),
      prevSiblingId: projection.prevSiblingId,
      nextSiblingId: projection.nextSiblingId,
      ...(section === project.projectStatus ? {} : { projectStatus: section }),
    };

    const unchanged =
      dto.parentProjectId === project.parentProjectId &&
      dto.projectStatus === undefined &&
      projection.prevSiblingId ===
        (findPreviousSibling(projects, project)?.id ?? null);

    if (unchanged) return;

    onMove(dto);
    onDropped(id);
  };

  return (
    <DragDropProvider
      sensors={sensors}
      plugins={(defaults) => [
        ...defaults,
        Feedback.configure({ dropAnimation: null }),
      ]}
      onDragStart={(event) =>
        begin(String(event.operation.source?.id).split(':').slice(1).join(':'))
      }
      onDragOver={(event) => {
        const { target } = event.operation;

        /* A row names its own category; the section-wide droppable behind them
           carries it in `data`, and is what makes the empty space below the last
           row — and a category with no rows at all — droppable. */
        const section = isSortable(target)
          ? (target.group as ProjectStatus)
          : ((target?.data as { status?: ProjectStatus } | undefined)?.status ??
            null);

        if (section === null) return;

        update(section, pointerY.current, event.operation.transform.x);
      }}
      onDragMove={(event) => {
        const { section } = latest.current;
        if (section === null) return;

        update(section, pointerY.current, event.operation.transform.x);
      }}
      onDragEnd={(event) => {
        const dragged = latest.current.id;
        if (dragged) traceDrop(dragged);

        if (event.canceled) {
          latest.current = {
            id: null,
            projection: null,
            section: null,
            gapIndex: null,
          };
          setDrag(EMPTY_DRAG);
          return;
        }

        finish();
      }}
    >
      <ProjectDragContext.Provider value={drag}>
        {children}
      </ProjectDragContext.Provider>
    </DragDropProvider>
  );
};
