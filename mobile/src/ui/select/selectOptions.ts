import type { ReactNode } from 'react';

export type SelectValue = string | number;

export type SelectOption<T extends SelectValue> = {
  value: T;
  label: ReactNode;
  /** Only needed when `label` is not a plain string — see `optionText`. */
  text?: string;
};

// A ReactNode cannot be read as text without rendering it, so an option
// carrying an icon has to say what it is called. Falling back to the label when
// it happens to be a string, and to the value otherwise, means numbers and
// plain names need no extra field.
export const optionText = <T extends SelectValue>(
  option: SelectOption<T>,
): string =>
  option.text ??
  (typeof option.label === 'string' ? option.label : String(option.value));

// Exact before prefix: with 1..31 in the list "3" is both an option and the
// start of two others, and the one actually typed has to win.
export const resolveTyped = <T extends SelectValue>(
  options: SelectOption<T>[],
  text: string,
): number => {
  const wanted = text.trim().toLowerCase();
  if (wanted === '') return -1;

  const texts = options.map((option) => optionText(option).toLowerCase());
  const exact = texts.indexOf(wanted);

  return exact >= 0
    ? exact
    : texts.findIndex((candidate) => candidate.startsWith(wanted));
};

export const numberRange = (from: number, to: number): SelectOption<number>[] =>
  Array.from({ length: Math.max(to - from + 1, 0) }, (_, step) => ({
    value: from + step,
    label: String(from + step),
  }));
