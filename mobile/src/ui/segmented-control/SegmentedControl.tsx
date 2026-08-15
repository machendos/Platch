import './SegmentedControl.css';

import type { CSSProperties, ReactNode } from 'react';

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
};

type SegmentedControlProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
};

// Generic over the value so call sites keep their own union — most of these
// bind to a backend enum (TimeComponentType, RecurringFrequency), and a plain
// `string` here would lose that at every one of them.
export const SegmentedControl = <T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: SegmentedControlProps<T>) => {
  const selectedIndex = options.findIndex((option) => option.value === value);

  return (
    <div
      className={
        className ? `segmented-control ${className}` : 'segmented-control'
      }
      role="group"
      aria-label={label}
      style={
        {
          '--segmented-count': options.length,
          '--segmented-index': Math.max(selectedIndex, 0),
        } as CSSProperties
      }
    >
      {selectedIndex >= 0 && (
        <span className="segmented-indicator" aria-hidden="true" />
      )}

      {options.map((option) => (
        <button
          key={option.value}
          className={
            option.value === value
              ? 'segmented-option segmented-option-selected'
              : 'segmented-option'
          }
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};
