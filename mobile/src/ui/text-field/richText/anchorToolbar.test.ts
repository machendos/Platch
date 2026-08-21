import { describe, expect, it } from 'vitest';
import { TOOLBAR_GAP, toolbarTopWithin } from './anchorToolbar';

const BAR = 38;
const CEILING = 100;

// Only top/bottom matter; the rest of DOMRect is along for the ride.
const field = (top: number, height: number) =>
  ({ top, bottom: top + height, height }) as DOMRect;

/* Returned relative to the field, so the assertions read as viewport
   positions by adding the field's own top back on. */
const viewportTop = (rect: DOMRect, height = 400) =>
  rect.top + toolbarTopWithin(rect, CEILING, height === 400 ? BAR : BAR);

describe('where the toolbar sits', () => {
  it('rides above the field while there is room', () => {
    const rect = field(300, 400);
    expect(viewportTop(rect)).toBe(300 - TOOLBAR_GAP - BAR);
  });

  it('stops at the ceiling instead of scrolling past it', () => {
    // The field's top has gone above the visible area entirely.
    expect(viewportTop(field(-500, 2000))).toBe(CEILING);
  });

  it('is already clamped the moment there is not room above', () => {
    const justAbove = CEILING + TOOLBAR_GAP + BAR;
    expect(viewportTop(field(justAbove, 400))).toBe(CEILING);
    expect(viewportTop(field(justAbove + 1, 400))).toBe(CEILING + 1);
  });

  it('leaves with the field rather than hanging over what follows', () => {
    // Scrolled so far that only the last 10px of the field is still visible.
    const rect = field(CEILING - 1990, 2000);
    expect(viewportTop(rect)).toBe(rect.bottom - BAR);
    expect(viewportTop(rect)).toBeLessThan(CEILING);
  });

  /* A field shorter than the toolbar has no answer that satisfies both, and
     the floor is the one that matters: a toolbar left hanging over the next
     field is worse than one poking above the scrolling area. */
  it('follows the floor when a field is shorter than the toolbar', () => {
    const rect = field(CEILING, 20);
    expect(viewportTop(rect)).toBe(rect.bottom - BAR);
  });
});
