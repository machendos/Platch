import { trashOutline } from 'ionicons/icons';
import type { MenuItem } from '../../../../../ui/menu/PopoverMenu';
import type { ProjectStatus } from '../projectTree';

const DESTINATION: Record<ProjectStatus, { label: string }> = {
  ACTIVE: { label: 'Add to Plan' },
  BACKLOG: { label: 'Move to Active' },
};

export const projectMenuItems = (status: ProjectStatus): MenuItem[] => [
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
    onSelect: () => {},
  },
  {
    id: 'move',
    label: DESTINATION[status].label,
    lucideIcon: 'arrow-up',
    showBorderAfter: true,
    onSelect: () => {},
  },
  {
    id: 'delete',
    label: 'Delete',
    ionIcon: trashOutline,
    isDestructive: true,
    onSelect: () => {},
  },
];
