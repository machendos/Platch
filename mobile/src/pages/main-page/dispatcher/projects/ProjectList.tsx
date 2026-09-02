import { Fragment, useMemo, useState } from 'react';
import type { ProjectWithTimeSlots } from '../../../../api/structures/ProjectWithTimeSlots';
import type { ProjectStatus } from './projectTree';
import { buildSectionRows } from './projectTree';
import { ConsequenceLine } from './ConsequenceLine';
import { ProjectRow } from './ProjectRow';
import { useProjectDrag } from './ProjectDragContext';
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

  /* The dragged project's descendants leave the list while it moves — they
     travel with it, and leaving them in would offer it a place inside itself.
     The dragged row itself stays: it is dnd-kit's drag source. */
  const visible = rows.filter((row) => !drag.hiddenIds.has(row.project.id));
  const lineAt = drag.section === status ? drag.gapIndex : null;

  return (
    <div className="project-list">
      {visible.map((row, index) => (
        <Fragment key={row.project.id}>
          {lineAt === index && (
            <ConsequenceLine depth={drag.projection?.depth} />
          )}
          <ProjectRow
            row={row}
            index={index}
            status={status}
            isExpanded={!collapsedIds.has(row.project.id)}
            onToggleExpanded={toggleExpanded}
          />
        </Fragment>
      ))}

      {lineAt === visible.length && (
        <ConsequenceLine depth={drag.projection?.depth} />
      )}
    </div>
  );
};
