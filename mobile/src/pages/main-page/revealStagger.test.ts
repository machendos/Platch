import { describe, expect, it } from 'vitest';
import {
  PROJECT_REVEAL_CASCADE_MS,
  PROJECT_REVEAL_STAGGER_MS,
  revealStagger,
} from './layout-config';

const cascade = (rowCount: number) => revealStagger(rowCount) * (rowCount - 1);

describe('revealStagger', () => {
  it('has nothing to stagger for a single row', () => {
    expect(revealStagger(1)).toBe(0);
    expect(revealStagger(0)).toBe(0);
  });

  it('keeps the full step while the subtree is small', () => {
    expect(revealStagger(2)).toBe(PROJECT_REVEAL_STAGGER_MS);
    expect(revealStagger(5)).toBe(PROJECT_REVEAL_STAGGER_MS);
  });

  it('never lets the cascade outrun its budget', () => {
    for (const rowCount of [10, 25, 60, 200]) {
      expect(cascade(rowCount)).toBeLessThanOrEqual(PROJECT_REVEAL_CASCADE_MS);
    }
  });

  it('tightens as the subtree grows rather than adding time', () => {
    expect(revealStagger(60)).toBeLessThan(revealStagger(10));
    expect(revealStagger(10)).toBeLessThan(revealStagger(5));
  });

  it('keeps a sixty-row subtree well under a second', () => {
    expect(cascade(60)).toBeLessThan(500);
  });
});
