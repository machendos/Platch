import './ToggleGroup.css';

import type { ReactNode } from 'react';

export type ToggleOption<T extends string> = {
  value: T;
  label: ReactNode;
};

export type ToggleGroupProps<T extends string> = {
  options: ToggleOption<T>[];
  values: readonly T[];
  onChange: (values: T[]) => void;
  label: string;
  /** Adds a leading segment that turns every option on, and off again once
      they all are. Omit it and the group is only its options. */
  selectAllLabel?: string;
  className?: string;
};

// SegmentedControl's sibling, for the fields that hold a set rather than one
// value — recurringByDay above all. It is not a `multiple` mode on that
// control because the two cannot draw the same way: a segmented control's
// selection is a single box that slides between options, and one box cannot be
// in three places. Here the fill belongs to each option instead, which is also
// what says the choices are independent.
export const ToggleGroup = <T extends string>({
  options,
  values,
  onChange,
  label,
  selectAllLabel,
  className,
}: ToggleGroupProps<T>) => {
  // Emitted in `options` order rather than the order they were pressed in, so
  // the caller always receives the same set written the same way and never has
  // to sort it back.
  const toggle = (value: T) => {
    const picked = new Set(values);
    if (picked.has(value)) picked.delete(value);
    else picked.add(value);

    onChange(
      options.map((option) => option.value).filter((v) => picked.has(v)),
    );
  };

  const allSelected = options.length > 0 && values.length === options.length;

  const classes = ['toggle-group', className].filter(Boolean).join(' ');

  return (
    <div className={classes} role="group" aria-label={label}>
      {/* Above the options rather than beside them, which is not a preference:
          at the size the options are drawn, seven of them plus this one do not
          fit a phone's width at all. See ToggleGroup.css. */}
      {selectAllLabel !== undefined && (
        <button
          className={
            allSelected
              ? 'toggle-option toggle-option-all toggle-option-selected'
              : 'toggle-option toggle-option-all'
          }
          type="button"
          aria-pressed={allSelected}
          onClick={() =>
            onChange(allSelected ? [] : options.map((option) => option.value))
          }
        >
          {selectAllLabel}
        </button>
      )}

      <div className="toggle-group-options">
        {options.map((option) => {
          const selected = values.includes(option.value);

          return (
            <button
              key={option.value}
              className={
                selected
                  ? 'toggle-option toggle-option-selected'
                  : 'toggle-option'
              }
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
