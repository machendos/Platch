import { describe, expect, it } from 'vitest';
import { dayHeaderFontSize } from './layoutConfig';

const DEFAULT = 18;
const MINIMUM = 10;

// "Sun 16" — three letters, a space, two digits.
const LABEL = 6;

describe('dayHeaderFontSize', () => {
  it('leaves a roomy column at the default size', () => {
    expect(dayHeaderFontSize(200, LABEL, 0)).toBe(DEFAULT);
  });

  it('still uses the default at the narrowest column when nothing is shifted', () => {
    expect(dayHeaderFontSize(80, LABEL, 0)).toBe(DEFAULT);
  });

  it('shrinks once a long offset has to share the narrowest column', () => {
    const size = dayHeaderFontSize(80, LABEL, '+2:45'.length);

    expect(size).toBeLessThan(DEFAULT);
    expect(size).toBeGreaterThan(MINIMUM);
  });

  it('charges less for the offset than for the label, since it is superscript', () => {
    expect(dayHeaderFontSize(80, LABEL, 5)).toBeGreaterThan(
      dayHeaderFontSize(80, LABEL + 5, 0),
    );
  });

  it('never goes below the readable floor', () => {
    expect(dayHeaderFontSize(20, LABEL, 5)).toBe(MINIMUM);
  });

  it('survives a column of zero width during first render', () => {
    expect(dayHeaderFontSize(0, LABEL, 0)).toBe(DEFAULT);
  });
});
