import { useMemo, useState } from 'react';
import type { ProjectWithTimeSlots } from '../../../../api/structures/ProjectWithTimeSlots';
import type { ProjectStatus } from './projectTree';
import { buildSectionRows } from './projectTree';
import { ConsequenceLine } from './ConsequenceLine';
import { ProjectRow } from './project-card/ProjectRow';
import { useProjectDrag } from './dnd/ProjectDragContext';
import './ProjectList.css';

type ProjectListProps = {
  projects: ProjectWithTimeSlots[];
  status: ProjectStatus;
};

export const ProjectList = ({ projects, status }: ProjectListProps) => {
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const drag = useProjectDrag();

  const rows = useMemo(
    () => buildSectionRows(projects, status, { collapsedIds }),
    [projects, status, collapsedIds],
  );

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
    <div className="project-list" data-section={status}>
      {placed.map(({ row, opensGap }, index) => (
        <ProjectRow
          key={row.project.id}
          row={row}
          index={index}
          opensGap={opensGap}
          status={status}
          isExpanded={!collapsedIds.has(row.project.id)}
          onToggleExpanded={toggleExpanded}
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
