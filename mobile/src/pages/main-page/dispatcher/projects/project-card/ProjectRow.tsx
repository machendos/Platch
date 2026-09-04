import { OptimisticSortingPlugin } from '@dnd-kit/dom/sortable';
import { useSortable } from '@dnd-kit/react/sortable';
import { ellipsisVertical } from 'ionicons/icons';
import { projectName } from '../../../../../config/labels';
import { IconButton } from '../../../../../ui/buttons/IconButton';
import { PopoverMenu } from '../../../../../ui/menu/PopoverMenu';
import { PROJECT_MENU_TRIGGER_SIZE } from '../../../layout-config';
import { ColorStrip } from './ColorStrip';
import { projectMenuItems } from './projectMenu';
import type {
  ProjectRow as ProjectRowModel,
  ProjectStatus,
} from '../projectTree';
import './ProjectRow.css';

type ProjectRowProps = {
  row: ProjectRowModel;
  index: number;
  opensGap?: boolean;
  status: ProjectStatus;
  isExpanded: boolean;
  onToggleExpanded: (id: string) => void;
};

export const ProjectRow = ({
  row,
  index,
  opensGap = false,
  status,
  isExpanded,
  onToggleExpanded,
}: ProjectRowProps) => {
  const { project, depth, isSpine, hasChildren, hexCode, ownsColor } = row;
  const name = projectName(project.name);

  const { ref, isDragSource } = useSortable({
    id: `${status}:${project.id}`,
    index,
    group: status,
    type: 'project',
    accept: 'project',
    disabled: { draggable: isSpine },
    data: { depth },
    plugins: (defaults) =>
      defaults.filter((plugin) => plugin !== OptimisticSortingPlugin),
    transition: null,
  });

  return (
    <div
      ref={ref}
      data-project-id={project.id}
      data-depth={depth}
      className={[
        'project-row',
        isSpine && 'project-row-spine',
        opensGap && 'project-row-gap-open',
        isDragSource && 'project-row-dragging',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        marginInlineStart: `calc(var(--project-indent-step) * ${depth})`,
      }}
    >
      <ColorStrip hexCode={hexCode} isInherited={!ownsColor} />

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
