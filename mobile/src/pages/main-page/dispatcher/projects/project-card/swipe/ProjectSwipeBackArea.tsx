import { DynamicIcon } from 'lucide-react/dynamic';
import type { ProjectAction } from '../projectMenu';
import './ProjectSwipeAction.css';

/* One per list, not one per row: only one row can be swiped at a time, and the
   surface has to span the whole line — which a child of the row could never do,
   since the row is indented and clips itself. The gesture positions it over
   whichever row is being swiped. */
export const ProjectSwipeBackArea = ({ action }: { action: ProjectAction }) => (
  <div className="project-swipe-action" aria-hidden="true">
    <DynamicIcon className="project-swipe-icon" name={action.lucideIcon} />
    <span className="project-swipe-label">{action.label}</span>
  </div>
);
