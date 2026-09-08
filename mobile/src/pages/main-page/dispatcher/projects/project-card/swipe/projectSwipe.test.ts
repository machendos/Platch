import { describe, expect, it } from 'vitest';
import { categoryMoveAction, projectMenuItems } from '../projectMenu';
import { projectSwipeAction } from './projectSwipe';

describe('projectSwipeAction', () => {
  it('promotes a backlog project', () => {
    expect(projectSwipeAction('BACKLOG')).toEqual({
      label: 'Move to Active',
      lucideIcon: 'arrow-up',
    });
  });

  /* Demoting stays behind the menu, so a stray sideways flick cannot bury a
     project that is being worked on. */
  it('leaves an active project alone', () => {
    expect(projectSwipeAction('ACTIVE')).toBeNull();
  });

  it('names the move exactly as the menu does', () => {
    const swipe = projectSwipeAction('BACKLOG');
    const item = projectMenuItems('BACKLOG', {
      onMoveToOtherCategory: () => {},
    }).find((entry) => entry.id === 'move-category');

    expect(swipe).not.toBeNull();
    expect(item?.label).toBe(swipe?.label);
    expect(item?.lucideIcon).toBe(swipe?.lucideIcon);
  });

  it('offers the swipe only where the menu already offers the move', () => {
    expect(projectSwipeAction('BACKLOG')).toEqual(
      categoryMoveAction('BACKLOG'),
    );
  });
});
