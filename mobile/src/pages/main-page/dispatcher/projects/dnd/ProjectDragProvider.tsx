import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DragDropProvider, PointerSensor } from '@dnd-kit/react';
import { Feedback, PointerActivationConstraints } from '@dnd-kit/dom';
import { isSortable } from '@dnd-kit/react/sortable';
import type { MoveProjectDto } from '../../../../../api/sdk/structures/MoveProjectDto';
import type { ProjectWithTimeSlots } from '../../../../../api/sdk/structures/ProjectWithTimeSlots';
import {
  DRAG_TOUCH_DELAY_MS,
  DRAG_TOUCH_TOLERANCE_PX,
  PROJECT_DROP_GAP,
  PROJECT_INDENT_STEP,
  PROJECT_ROW_GAP,
  PROJECT_ROW_MIN_HEIGHT,
} from '../../layoutConfig';
import { generateKeyBetween } from 'fractional-indexing';
import type { ProjectStatus } from '../projectTree';
import { buildSectionRows } from '../projectTree';
import { collectDescendantIds } from './applyMove';
import type { Projection } from './dropProjection';
import { resolveDrop } from './dropProjection';
import type { DragState } from './ProjectDragContext';
import { EMPTY_DRAG, ProjectDragContext } from './ProjectDragContext';

type ProjectDragProviderProps = {
  projects: ProjectWithTimeSlots[];
  onMove: (dto: MoveProjectDto) => void;
  onDropped: (id: string) => void;
  children: ReactNode;
};

/* The controls inside a row that answer for themselves. Neither the drag nor
   the row's own press may claim them — a tap on either does something else, and
   both already have their own feedback.

   Everything else in the row drags, the name included. The sensor refuses to
   start a drag on any button by default, and the name is a button covering most
   of the row, which had left the colour strip as the only place a project could
   be picked up at all. Replacing that rule rather than widening it is safe here
   because a project row is the only draggable there is. */
const ROW_CONTROLS =
  '.project-row-chevron-button, .popover-menu-trigger';

/* The browser still fires a click after a drag, and dnd-kit only calls
   preventDefault on it — which cancels the default action but not a React
   handler, so a row that had just been dragged opened its project on release.

   Swallowed in the capture phase, before React sees it. Disarmed by the click
   it was waiting for, or by the next press if none ever came — a drag that ends
   in a cancel produces no click, and the listener must not be left lying in
   wait for a real one. */
const swallowClickAfterDrag = () => {
  const disarm = () => {
    document.removeEventListener('click', swallow, true);
    document.removeEventListener('pointerdown', disarm, true);
  };
  const swallow = (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    disarm();
  };

  document.addEventListener('click', swallow, true);
  document.addEventListener('pointerdown', disarm, true);
};

const sensors = [
  PointerSensor.configure({
    preventActivation: (event) =>
      event.target instanceof Element &&
      event.target.closest(ROW_CONTROLS) !== null,
    /* Whichever fires first wins — the controller stops at the first constraint
       to activate, and a delay that loses its tolerance cancels only itself.

       A mouse gets both: moving is unambiguous so it picks the row up at once,
       and holding still picks it up too, so "press and hold" means the same
       thing on every input. A finger gets only the hold, because an immediate
       distance would leave the list unscrollable. */
    activationConstraints: (event) => {
      const hold = new PointerActivationConstraints.Delay({
        value: DRAG_TOUCH_DELAY_MS,
        tolerance: DRAG_TOUCH_TOLERANCE_PX,
      });

      return event.pointerType === 'mouse'
        ? [new PointerActivationConstraints.Distance({ value: 4 }), hold]
        : [hold];
    },
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
        swallowClickAfterDrag();

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
