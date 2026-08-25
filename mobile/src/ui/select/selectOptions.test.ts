import { describe, expect, it } from 'vitest';
import { numberRange, optionText, resolveTyped } from './selectOptions';

const DAYS = numberRange(1, 31);

describe('numberRange', () => {
  it('is inclusive of both ends', () => {
    expect(DAYS).toHaveLength(31);
    expect(DAYS[0].value).toBe(1);
    expect(DAYS[30].value).toBe(31);
  });

  it('is empty rather than negative when the range is inverted', () => {
    expect(numberRange(5, 1)).toEqual([]);
  });
});

describe('optionText', () => {
  it('prefers an explicit text', () => {
    expect(optionText({ value: 1, label: 'One', text: 'first' })).toBe('first');
  });

  it('falls back to a string label, then to the value', () => {
    expect(optionText({ value: 'MO', label: 'Monday' })).toBe('Monday');
    expect(optionText({ value: 7, label: null })).toBe('7');
  });
});

describe('resolveTyped', () => {
  it('matches an exact value ahead of the options it prefixes', () => {
    expect(resolveTyped(DAYS, '3')).toBe(2);
    expect(resolveTyped(DAYS, '30')).toBe(29);
  });

  it('ignores surrounding space and case', () => {
    const months = [
      { value: 'JAN', label: 'January' },
      { value: 'JUN', label: 'June' },
      { value: 'JUL', label: 'July' },
    ];

    expect(resolveTyped(months, '  jun ')).toBe(1);
    expect(resolveTyped(months, 'ju')).toBe(1);
  });

  it('reports no match for empty or unreadable text', () => {
    expect(resolveTyped(DAYS, '')).toBe(-1);
    expect(resolveTyped(DAYS, '   ')).toBe(-1);
    expect(resolveTyped(DAYS, '99')).toBe(-1);
  });
});
