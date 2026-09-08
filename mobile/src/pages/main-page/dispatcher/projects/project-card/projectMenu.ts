import { trashOutline } from 'ionicons/icons';
import type { MenuItem } from '../../../../../ui/menu/PopoverMenu';
import type { LucideIcon } from '../../../../../system/lucideIcons';
import type { ProjectStatus } from '../projectTree';

type ProjectMenuActions = { onMoveToOtherCategory: () => void };

export type ProjectAction = { label: string; lucideIcon: LucideIcon };

/* The one action with two entry points — this menu and the row swipe. Named
   here, where the full set of actions lives, and read by the swipe rather than
   restated there, so the two can never end up calling it different things. */
export const categoryMoveAction = (status: ProjectStatus): ProjectAction =>
  status === 'ACTIVE'
    ? { label: 'Move to Backlog', lucideIcon: 'arrow-down' }
    : { label: 'Move to Active', lucideIcon: 'arrow-up' };

export const projectMenuItems = (
  status: ProjectStatus,
  { onMoveToOtherCategory }: ProjectMenuActions,
): MenuItem[] => [
  {
    id: 'pin',
    label: 'Pin',
    lucideIcon: 'pin',
    fillIcon: true,
    onSelect: () => {},
  },
  {
    id: 'add-subtask',
    label: 'Add subtask',
    lucideIcon: 'plus',
    showBorderAfter: true,
    onSelect: () => {},
  },
  ...(status === 'ACTIVE'
    ? [
        {
          id: 'add-to-plan',
          label: 'Add to Plan',
          lucideIcon: 'arrow-up',
          onSelect: () => {},
        } as MenuItem,
      ]
    : []),

  {
    id: 'move-category',
    ...categoryMoveAction(status),
    showBorderAfter: true,
    onSelect: onMoveToOtherCategory,
  },

  {
    id: 'delete',
    label: 'Delete',
    ionIcon: trashOutline,
    isDestructive: true,
    onSelect: () => {},
  },
];
