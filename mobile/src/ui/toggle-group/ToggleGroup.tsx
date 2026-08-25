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
  /** Adds an action above the options that turns every one of them on. Omit it
      and the group is only its options. */
  selectAllLabel?: string;
  /** What that action says once they are all on, when it clears them instead.
      Defaults to `selectAllLabel`, which suits a set whose two directions do
      not need different words. */
  clearAllLabel?: string;
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
  clearAllLabel,
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
      {/* One flex item holding all the options, so the days are a block that
          wraps or does not wrap as a unit. Letting them into the wrapping row
          individually would break the week across two lines, four days above
          three, which is the one arrangement nobody wants. */}
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

      {/* After the options, and no aria-pressed: this is a command and not a
          toggle. Its label already says what pressing it will do, and a
          pressed state on top of that would be a second, quieter answer to the
          same question. */}
      {selectAllLabel !== undefined && (
        <button
          className="toggle-select-all"
          type="button"
          onClick={() =>
            onChange(allSelected ? [] : options.map((option) => option.value))
          }
        >
          {allSelected ? (clearAllLabel ?? selectAllLabel) : selectAllLabel}
        </button>
      )}
    </div>
  );
};
