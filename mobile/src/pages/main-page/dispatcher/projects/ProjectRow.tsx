import { projectName } from '../../../../config/labels';
import { IconButton } from '../../../../ui/buttons/IconButton';
import type { ProjectRow as ProjectRowModel } from './projectTree';
import './ProjectRow.css';

type ProjectRowProps = {
  row: ProjectRowModel;
  isExpanded: boolean;
  onToggleExpanded: (id: string) => void;
};

export const ProjectRow = ({
  row,
  isExpanded,
  onToggleExpanded,
}: ProjectRowProps) => {
  const { project, depth, isSpine, hasChildren } = row;
  const name = projectName(project.name);

  return (
    <div
      className={isSpine ? 'project-row project-row-spine' : 'project-row'}
      style={{
        marginInlineStart: `calc(var(--project-indent-step) * ${depth})`,
      }}
    >
      {/* The slot is rendered whether or not it holds a chevron, so a leaf's
          name starts where its siblings' names do. */}
      <span className="project-row-chevron-slot">
        {hasChildren && (
          <IconButton
            className="project-row-chevron-button"
            label={isExpanded ? `Collapse ${name}` : `Expand ${name}`}
            onClick={() => onToggleExpanded(project.id)}
          >
            <span
              className={
                isExpanded
                  ? 'project-row-chevron project-row-chevron-expanded'
                  : 'project-row-chevron'
              }
            >
              ›
            </span>
          </IconButton>
        )}
      </span>

      <span className="project-row-lines">
        <span className="project-row-name">{name}</span>
        {/* Held for the schedule, duration and cadence the concept puts on a
            second line. Empty on purpose — the row's height must not change
            when they arrive. */}
        <span className="project-row-meta" aria-hidden="true" />
      </span>
    </div>
  );
};
