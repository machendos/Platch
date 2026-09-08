import { clamp } from '../../../../../../system/helpers/helpers';
import {
  PROJECT_SWIPE_FRACTION,
  PROJECT_SWIPE_LOCK_DISTANCE,
  PROJECT_SWIPE_LOCK_RATIO,
  PROJECT_SWIPE_MAX_DISTANCE,
  PROJECT_SWIPE_MIN_DISTANCE,
} from '../../../layoutConfig';

export type SwipeAxisManager = 'horizontal' | 'vertical';

/**
 * Which way a touch is going, or `null` while it is too early to say.
 *
 * Measured from where the finger landed, not from the previous frame: a swipe
 * that slows to a crawl is still a swipe, and per-frame deltas read as noise.
 */
export const decideAxis = (dx: number, dy: number): SwipeAxisManager | null => {
  if (Math.hypot(dx, dy) < PROJECT_SWIPE_LOCK_DISTANCE) return null;

  return Math.abs(dx) > Math.abs(dy) * PROJECT_SWIPE_LOCK_RATIO
    ? 'horizontal'
    : 'vertical';
};

/** How far a row travels before letting go commits the move. */
export const swipeCommitDistance = (rowWidth: number) =>
  clamp(
    rowWidth * PROJECT_SWIPE_FRACTION,
    PROJECT_SWIPE_MIN_DISTANCE,
    PROJECT_SWIPE_MAX_DISTANCE,
  );
