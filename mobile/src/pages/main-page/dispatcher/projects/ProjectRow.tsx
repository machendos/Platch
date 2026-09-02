import { useSortable } from '@dnd-kit/react/sortable';
import { ellipsisVertical } from 'ionicons/icons';
import { projectName } from '../../../../config/labels';
import { IconButton } from '../../../../ui/buttons/IconButton';
import { PopoverMenu } from '../../../../ui/menu/PopoverMenu';
import { PROJECT_MENU_TRIGGER_SIZE } from '../../layout-config';
import { ColorStrip } from './ColorStrip';
import { projectMenuItems } from './projectMenu';
import type {
  ProjectRow as ProjectRowModel,
  ProjectStatus,
} from './projectTree';
import './ProjectRow.css';

type ProjectRowProps = {
  row: ProjectRowModel;
  index: number;
  status: ProjectStatus;
  isExpanded: boolean;
  onToggleExpanded: (id: string) => void;
};

export const ProjectRow = ({
  row,
  index,
  status,
  isExpanded,
  onToggleExpanded,
}: ProjectRowProps) => {
  const { project, depth, isSpine, hasChildren } = row;
  const name = projectName(project.name);

  /* A spine is an ancestor borrowed from the other section; it has no position
     in this one to change, so it is not a drag source. It stays a drop target,
     because rows do land under it. */
  const { ref, isDragSource } = useSortable({
    id: project.id,
    index,
    group: status,
    type: 'project',
    accept: 'project',
    disabled: { draggable: isSpine },
    data: { depth },
  });

  return (
    <div
      ref={ref}
      className={[
        'project-row',
        isSpine && 'project-row-spine',
        isDragSource && 'project-row-dragging',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        marginInlineStart: `calc(var(--project-indent-step) * ${depth})`,
      }}
    >
      <ColorStrip
        hexCode={project.color?.hexCode ?? null}
        isNested={depth > 0}
      />

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

      <PopoverMenu
        items={projectMenuItems(status)}
        label={`${name} actions`}
        icon={ellipsisVertical}
        triggerSize={PROJECT_MENU_TRIGGER_SIZE}
      />
    </div>
  );
};
