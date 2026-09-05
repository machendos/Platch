import { trashOutline } from 'ionicons/icons';
import type { MenuItem } from '../../../../../ui/menu/PopoverMenu';
import type { ProjectStatus } from '../projectTree';

type ProjectMenuActions = { onMoveToOtherCategory: () => void };

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
        {
          id: 'move-category',
          label: 'Move to Backlog',
          lucideIcon: 'arrow-down',
          showBorderAfter: true,
          onSelect: onMoveToOtherCategory,
        } as MenuItem,
      ]
    : []),

  ...(status === 'BACKLOG'
    ? [
        {
          id: 'move-category',
          label: 'Move to Active',
          lucideIcon: 'arrow-up',
          showBorderAfter: true,
          onSelect: onMoveToOtherCategory,
        } as MenuItem,
      ]
    : []),

  {
    id: 'delete',
    label: 'Delete',
    ionIcon: trashOutline,
    isDestructive: true,
    onSelect: () => {},
  },
];
