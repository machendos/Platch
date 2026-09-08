import type { ProjectStatus } from '../../projectTree';
import { categoryMoveAction } from '../projectMenu';

/* Which sections a row can be swiped out of, and nothing else — the gesture
   itself only asks whether there is an action here.

   ACTIVE is deliberately absent. Demoting to BACKLOG stays behind the menu so a
   stray sideways flick cannot bury a project that is being worked on; promoting
   is the common move and the one worth a shortcut. PLAN has no entry because it
   has no data yet. When it does, this list is what grows — not the gesture. */
const SWIPEABLE: readonly ProjectStatus[] = ['BACKLOG'];

export const projectSwipeAction = (status: ProjectStatus) =>
  SWIPEABLE.includes(status) ? categoryMoveAction(status) : null;
