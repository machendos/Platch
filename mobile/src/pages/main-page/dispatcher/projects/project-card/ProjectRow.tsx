import { OptimisticSortingPlugin } from '@dnd-kit/dom/sortable';
import { useSortable } from '@dnd-kit/react/sortable';
import { ellipsisVertical } from 'ionicons/icons';
import { projectName } from '../../../../../config/labels';
import { IconButton } from '../../../../../ui/buttons/IconButton';
import { PopoverMenu } from '../../../../../ui/menu/PopoverMenu';
import { PROJECT_MENU_TRIGGER_SIZE } from '../../layoutConfig';
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
  onOpen: (project: ProjectRowModel['project']) => void;
  onMoveToOtherCategory: (id: string) => void;
  revealDelayMs: number | null;
};

export const ProjectRow = ({
  row,
  index,
  opensGap = false,
  status,
  isExpanded,
  onToggleExpanded,
  onOpen,
  onMoveToOtherCategory,
  revealDelayMs,
}: ProjectRowProps) => {
  const { project, depth, hasChildren, hexCode, ownsColor } = row;
  const name = projectName(project.name);

  const { ref, isDragSource } = useSortable({
    id: `${status}:${project.id}`,
    index,
    group: status,
    type: 'project',
    accept: 'project',
    data: { depth },
    plugins: (defaults) =>
      defaults.filter((plugin) => plugin !== OptimisticSortingPlugin),
    /* Zero duration, not `null`. `useSortable` does `{...defaultSortableTransition,
       ...input.transition}`, and spreading `null` contributes nothing — so `null`
       silently restores the 250ms default and slides the row from where the drag
       began to where it landed, after the finger has already carried it there. */
    transition: { duration: 0, easing: 'linear', idle: false },
  });

  return (
    <div
      ref={ref}
      data-project-id={project.id}
      data-depth={depth}
      className={[
        'project-row',
        revealDelayMs !== null && 'project-row-revealing',
        opensGap && 'project-row-gap-open',
        isDragSource && 'project-row-dragging',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        marginInlineStart: `calc(var(--project-indent-step) * ${depth})`,
        ...(revealDelayMs === null
          ? {}
          : { animationDelay: `${Math.round(revealDelayMs)}ms` }),
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

      {/* The name block is the row's tap target rather than the row itself:
          the chevron and the menu are buttons already, and a button cannot
          nest inside one. It stretches to fill everything between them, so
          what is left to press is the whole row minus its two controls. */}
      <button
        className="project-row-lines"
        type="button"
        onClick={() => onOpen(project)}
      >
        <span className="project-row-name">{name}</span>
        <span className="project-row-meta" aria-hidden="true" />
      </button>

      <PopoverMenu
        items={projectMenuItems(status, {
          onMoveToOtherCategory: () => onMoveToOtherCategory(project.id),
        })}
        label={`${name} actions`}
        icon={ellipsisVertical}
        triggerSize={PROJECT_MENU_TRIGGER_SIZE}
      />
    </div>
  );
};
