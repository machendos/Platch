import { describe, expect, it } from 'vitest';
import { DISPATCHER_MIN_PANE_WIDTH } from '../../../../layout-config';
import {
  DRAG_TOUCH_TOLERANCE_PX,
  PROJECT_SWIPE_MAX_DISTANCE,
  PROJECT_SWIPE_MIN_DISTANCE,
} from '../../../layoutConfig';
import { decideAxis, swipeCommitDistance } from './swipeAxisManager';

describe('decideAxis', () => {
  it('says nothing until the finger has travelled far enough', () => {
    expect(decideAxis(0, 0)).toBeNull();
    expect(decideAxis(4, 0)).toBeNull();
    expect(decideAxis(0, -6)).toBeNull();
  });

  /* Below dnd-kit's tolerance the long press is still pending, so claiming the
     touch there would leave it both dragged and swiped. */
  it('waits at least as long as the drag does', () => {
    expect(decideAxis(DRAG_TOUCH_TOLERANCE_PX - 1, 0)).toBeNull();
    expect(decideAxis(DRAG_TOUCH_TOLERANCE_PX, 0)).toBe('horizontal');
  });

  it('reads a straight sideways drag as a swipe, either way', () => {
    expect(decideAxis(30, 2)).toBe('horizontal');
    expect(decideAxis(-30, 2)).toBe('horizontal');
  });

  it('reads a straight vertical drag as a scroll', () => {
    expect(decideAxis(0, 30)).toBe('vertical');
    expect(decideAxis(3, -30)).toBe('vertical');
  });

  /* The tie-break leans to scrolling on purpose: it is the common intent, and
     wrongly stealing it is worse than missing a swipe. */
  it('gives an even diagonal to the scroller', () => {
    expect(decideAxis(30, 30)).toBe('vertical');
    expect(decideAxis(-30, 30)).toBe('vertical');
  });

  it('takes a diagonal only once it is decidedly sideways', () => {
    expect(decideAxis(30, 26)).toBe('vertical');
    expect(decideAxis(30, 20)).toBe('horizontal');
  });
});

describe('swipeCommitDistance', () => {
  it('scales with the row', () => {
    expect(swipeCommitDistance(300)).toBeGreaterThan(swipeCommitDistance(200));
  });

  it('stays reachable on the narrowest the pane can be dragged to', () => {
    expect(swipeCommitDistance(DISPATCHER_MIN_PANE_WIDTH)).toBe(
      PROJECT_SWIPE_MIN_DISTANCE,
    );
  });

  it('does not ask for a whole arm on a wide pane', () => {
    expect(swipeCommitDistance(4000)).toBe(PROJECT_SWIPE_MAX_DISTANCE);
  });

  it('always asks for more than the axis lock', () => {
    for (const width of [DISPATCHER_MIN_PANE_WIDTH, 200, 360, 1200]) {
      expect(swipeCommitDistance(width)).toBeGreaterThan(
        DRAG_TOUCH_TOLERANCE_PX,
      );
    }
  });
});
