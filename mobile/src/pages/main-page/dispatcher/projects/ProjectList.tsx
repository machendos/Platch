import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CollisionPriority } from '@dnd-kit/abstract';
import { useDroppable } from '@dnd-kit/react';
import type { ProjectWithTimeSlots } from '../../../../api/sdk/structures/ProjectWithTimeSlots';
import type { ProjectStatus } from './projectTree';
import { buildSectionRows } from './projectTree';
import { ConsequenceLine } from './ConsequenceLine';
import { ProjectRow } from './project-card/ProjectRow';
import { ProjectSwipeBackArea } from './project-card/swipe/ProjectSwipeBackArea';
import { projectSwipeAction } from './project-card/swipe/projectSwipe';
import { useProjectSwipe } from './project-card/swipe/useProjectSwipe';
import { collectDescendantIds } from './dnd/applyMove';
import { useProjectDrag } from './dnd/ProjectDragContext';
import { prefersReducedMotion } from '../../../../system/helpers/prefersReducedMotion';
import { PROJECT_REVEAL_DURATION_MS, revealStagger } from '../layoutConfig';
import type { ProjectRow as ProjectRowModel } from './projectTree';
import './ProjectList.css';

export type RevealRequest = { id: string; token: number };

type ProjectListProps = {
  projects: ProjectWithTimeSlots[];
  status: ProjectStatus;
  onProjectEditOpen: (project: ProjectWithTimeSlots) => void;
  reveal: RevealRequest | null;
  onMoveToOtherCategory: (id: string) => void;
};

/* The landed project and its real descendants, in the order they are drawn.
   Not the run of deeper rows following it — that also swallows unrelated
   branches that merely happen to sit lower in the tree. */
const landedRun = (
  rows: ProjectRowModel[],
  projects: ProjectWithTimeSlots[],
  id: string,
) => {
  const subtree = collectDescendantIds(projects, id);

  return rows
    .filter((row) => subtree.has(row.project.id))
    .map((row) => row.project.id);
};

const withAncestorsExpanded = (
  collapsedIds: ReadonlySet<string>,
  projects: ProjectWithTimeSlots[],
  id: string,
) => {
  const byId = new Map(projects.map((project) => [project.id, project]));
  const next = new Set(collapsedIds);
  const seen = new Set<string>();

  let parentId = byId.get(id)?.parentProjectId ?? null;

  while (parentId !== null && !seen.has(parentId)) {
    seen.add(parentId);
    next.delete(parentId);
    parentId = byId.get(parentId)?.parentProjectId ?? null;
  }

  return next.size === collapsedIds.size ? collapsedIds : next;
};

export const ProjectList = ({
  projects,
  status,
  onProjectEditOpen,
  reveal,
  onMoveToOtherCategory,
}: ProjectListProps) => {
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const drag = useProjectDrag();
  const listRef = useRef<HTMLDivElement>(null);

  /* The rows are the only drop targets dnd-kit knows about, so the empty space
     below them belongs to nobody and a category with no rows at all cannot be
     dropped into. The list itself takes the whole section body (see the CSS) and
     accepts at the lowest priority, so a row still wins wherever there is one. */
  const { ref: dropRef } = useDroppable({
    id: `section:${status}`,
    type: 'section',
    accept: 'project',
    collisionPriority: CollisionPriority.Lowest,
    data: { status },
  });
  /* What this section's rows offer to a swipe, and what taking it up does. The
     gesture is told only that much — which action belongs to which section is
     decided here and in projectSwipe.ts, so a future section over different data
     supplies its own without the gesture changing. */
  const swipeAction = projectSwipeAction(status);
  const swipe = swipeAction && {
    ...swipeAction,
    onCommit: onMoveToOtherCategory,
  };

  const revealed = useRef<number | null>(null);
  const animated = useRef<number | null>(null);
  const [revealing, setRevealing] = useState<readonly string[]>([]);

  const rows = useMemo(
    () => buildSectionRows(projects, status, { collapsedIds }),
    [projects, status, collapsedIds],
  );

  useProjectSwipe(listRef, {
    action: swipe,
    /* The swiped project carries its subtree, so the whole run has to close its
       space together — the same set the arrival animates, in the same order. */
    rowsLeavingWith: (id: string) => {
      const subtree = collectDescendantIds(projects, id);
      return rows
        .map((each) => each.project.id)
        .filter((each) => subtree.has(each));
    },
  });

  /* Expanding is a state change, so this runs again on the next render and
     falls through to the scroll once the row is actually on screen. The token
     is what stops it repeating; a collapsed section never mounts this at all,
     which is how a closed destination stays closed. */
  useEffect(() => {
    if (!reveal || revealed.current === reveal.token) return;
    if (!rows.some((row) => row.project.id === reveal.id)) return;

    const expanded = withAncestorsExpanded(collapsedIds, projects, reveal.id);

    if (expanded !== collapsedIds) {
      setCollapsedIds(expanded);
      return;
    }

    revealed.current = reveal.token;

    const frame = requestAnimationFrame(() => {
      listRef.current
        ?.querySelector(`[data-project-id="${reveal.id}"]`)
        ?.scrollIntoView({
          block: 'nearest',
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        });
    });

    return () => cancelAnimationFrame(frame);
  }, [reveal, rows, collapsedIds, projects]);

  /* Held in state for exactly as long as the animation runs, so re-renders
     during it cannot restart it and nothing lingers afterwards.

     Layout, not passive: a plain effect runs *after* the browser has painted, so
     the arriving rows were drawn once at full height before the class that
     collapses them landed — a flash of the finished list, then the unfold. */
  useLayoutEffect(() => {
    if (!reveal || animated.current === reveal.token) return;

    const ids = landedRun(rows, projects, reveal.id);
    if (ids.length === 0) return;

    animated.current = reveal.token;
    setRevealing(ids);
  }, [reveal, rows, projects]);

  /* The clearing timer lives here, keyed on what it clears, and not in the
     effect above. There it was armed and disarmed together with an effect that
     re-runs on every `rows`/`projects` identity change: the cleanup cancelled
     the timer, the token guard then returned early, and it was never re-armed.
     The class stayed on the row for good — and since it outranks the departure
     wipe, a row that had ever arrived could never afterwards animate away. */
  useEffect(() => {
    if (revealing.length === 0) return;

    const clear = globalThis.setTimeout(
      () => setRevealing([]),
      PROJECT_REVEAL_DURATION_MS +
        revealStagger(revealing.length) * (revealing.length - 1),
    );

    return () => globalThis.clearTimeout(clear);
  }, [revealing]);

  const toggleExpanded = (id: string) =>
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else next.add(id);
      return next;
    });

  /* A row being carried is not also arriving. Without this the reveal class can
     still be on it when dnd-kit clones it into a placeholder. */
  useEffect(() => {
    if (drag.draggingId !== null) setRevealing([]);
  }, [drag.draggingId]);

  const visible = rows.filter((row) => !drag.hiddenIds.has(row.project.id));
  const lineAt = drag.section === status ? drag.gapIndex : null;

  const showLine = lineAt !== null && drag.gapTop !== null;

  let landable = 0;
  const placed = visible.map((row) => {
    const isDragged = row.project.id === drag.draggingId;
    const opensGap = !isDragged && landable === lineAt;
    if (!isDragged) landable += 1;
    return { row, opensGap };
  });

  return (
    <div
      className="project-list"
      data-section={status}
      ref={(element) => {
        listRef.current = element;
        dropRef(element);
      }}
    >
      {swipeAction && <ProjectSwipeBackArea action={swipeAction} />}

      {placed.map(({ row, opensGap }, index) => (
        <ProjectRow
          key={row.project.id}
          row={row}
          index={index}
          opensGap={opensGap}
          status={status}
          isExpanded={!collapsedIds.has(row.project.id)}
          onToggleExpanded={toggleExpanded}
          onOpen={onProjectEditOpen}
          onMoveToOtherCategory={onMoveToOtherCategory}
          revealDelayMs={
            revealing.indexOf(row.project.id) === -1
              ? null
              : revealing.indexOf(row.project.id) *
                revealStagger(revealing.length)
          }
        />
      ))}

      {showLine && (
        <ConsequenceLine
          top={drag.gapTop as number}
          depth={drag.projection?.depth ?? 0}
        />
      )}
    </div>
  );
};
