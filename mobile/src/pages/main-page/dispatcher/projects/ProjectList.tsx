import { useEffect, useMemo, useRef, useState } from 'react';
import { CollisionPriority } from '@dnd-kit/abstract';
import { useDroppable } from '@dnd-kit/react';
import type { ProjectWithTimeSlots } from '../../../../api/structures/ProjectWithTimeSlots';
import type { ProjectStatus } from './projectTree';
import { buildSectionRows } from './projectTree';
import { ConsequenceLine } from './ConsequenceLine';
import { ProjectRow } from './project-card/ProjectRow';
import { useProjectDrag } from './dnd/ProjectDragContext';
import { prefersReducedMotion } from '../../../../system/helpers/prefersReducedMotion';
import './ProjectList.css';

export type RevealRequest = { id: string; token: number };

type ProjectListProps = {
  projects: ProjectWithTimeSlots[];
  status: ProjectStatus;
  reveal: RevealRequest | null;
  onMoveToOtherCategory: (id: string) => void;
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
  const revealed = useRef<number | null>(null);

  const rows = useMemo(
    () => buildSectionRows(projects, status, { collapsedIds }),
    [projects, status, collapsedIds],
  );

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

  const toggleExpanded = (id: string) =>
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else next.add(id);
      return next;
    });

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
      {placed.map(({ row, opensGap }, index) => (
        <ProjectRow
          key={row.project.id}
          row={row}
          index={index}
          opensGap={opensGap}
          status={status}
          isExpanded={!collapsedIds.has(row.project.id)}
          onToggleExpanded={toggleExpanded}
          onMoveToOtherCategory={onMoveToOtherCategory}
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
