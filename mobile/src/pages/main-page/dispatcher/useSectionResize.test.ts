import { describe, expect, it } from 'vitest';
import { applySectionDrag } from './useSectionResize';
import { SECTION_MIN_HEIGHT } from './layoutConfig';

const roomy = SECTION_MIN_HEIGHT * 3;

describe('applySectionDrag', () => {
  it('takes the whole drag while both sections have room', () => {
    expect(applySectionDrag(20, roomy, roomy)).toEqual({
      applied: 20,
      bound: false,
    });
  });

  it('stops the section above at the floor, not at its header', () => {
    expect(applySectionDrag(-500, SECTION_MIN_HEIGHT + 10, roomy)).toEqual({
      applied: -10,
      bound: true,
    });
  });

  it('stops the section below at the floor', () => {
    expect(applySectionDrag(500, roomy, SECTION_MIN_HEIGHT + 10)).toEqual({
      applied: 10,
      bound: true,
    });
  });

  it('reports a drag that lands exactly on the floor as bound', () => {
    expect(applySectionDrag(-10, SECTION_MIN_HEIGHT + 10, roomy)).toEqual({
      applied: -10,
      bound: false,
    });
  });

  /* A dispatcher too short for three floors — reachable on a small screen with
     everything expanded. The bounds invert there, and clamp would answer with a
     number outside its own range. */
  it('refuses to move a pair that is already under the floor', () => {
    const cramped = SECTION_MIN_HEIGHT - 20;

    expect(applySectionDrag(50, cramped, cramped)).toEqual({
      applied: 0,
      bound: true,
    });
    expect(applySectionDrag(-50, cramped, cramped)).toEqual({
      applied: 0,
      bound: true,
    });
  });
});
