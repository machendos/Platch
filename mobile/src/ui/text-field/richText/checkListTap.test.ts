import { describe, expect, it } from 'vitest';
import { MARKER_TAP_PAD, isMarkerTap } from './checkListTap';

const MARKER = 20;
// Only `left` matters; the rest is along for the ride.
const item = (left: number) => ({ left }) as DOMRect;

/* The layout these numbers answer to: the marker is drawn at the item's left
   edge at --checkbox-size wide, and the text begins --checkbox-gap after it. */
const LEFT = 100;
const TEXT_STARTS = LEFT + MARKER + 8;

describe('where a tap counts as the checkbox', () => {
  it('takes the marker itself', () => {
    expect(isMarkerTap(LEFT, item(LEFT), MARKER)).toBe(true);
    expect(isMarkerTap(LEFT + MARKER / 2, item(LEFT), MARKER)).toBe(true);
    expect(isMarkerTap(LEFT + MARKER, item(LEFT), MARKER)).toBe(true);
  });

  it('takes a little either side, for fingers', () => {
    expect(isMarkerTap(LEFT - MARKER_TAP_PAD, item(LEFT), MARKER)).toBe(true);
    expect(
      isMarkerTap(LEFT + MARKER + MARKER_TAP_PAD, item(LEFT), MARKER),
    ).toBe(true);
  });

  /* The whole point. Lexical pads by 32px on touch, which reaches past the gap
     and into the words — on a short line that is most of the text, so tapping
     to place the caret toggled the checkbox instead. */
  it('never reaches the text', () => {
    expect(isMarkerTap(TEXT_STARTS, item(LEFT), MARKER)).toBe(false);
    expect(isMarkerTap(TEXT_STARTS + 1, item(LEFT), MARKER)).toBe(false);
    expect(isMarkerTap(LEFT + 52, item(LEFT), MARKER)).toBe(false);
  });

  it('leaves a gap between the target and the first character', () => {
    expect(LEFT + MARKER + MARKER_TAP_PAD).toBeLessThan(TEXT_STARTS);
  });

  it('ignores a tap well before the line', () => {
    expect(isMarkerTap(LEFT - 40, item(LEFT), MARKER)).toBe(false);
  });
});
