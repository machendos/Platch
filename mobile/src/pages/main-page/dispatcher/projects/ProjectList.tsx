import { useMemo, useState } from 'react';
import type { ProjectWithTimeSlots } from '../../../../api/structures/ProjectWithTimeSlots';
import type { ProjectStatus } from './projectTree';
import { buildSectionRows } from './projectTree';
import { ProjectRow } from './ProjectRow';
import './ProjectList.css';

type ProjectListProps = {
  projects: ProjectWithTimeSlots[];
  status: ProjectStatus;
};

export const ProjectList = ({ projects, status }: ProjectListProps) => {
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(
    new Set(),
  );

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

  return (
    <div className="project-list">
      {rows.map((row) => (
        <ProjectRow
          key={row.project.id}
          row={row}
          isExpanded={!collapsedIds.has(row.project.id)}
          onToggleExpanded={toggleExpanded}
        />
      ))}
    </div>
  );
};
