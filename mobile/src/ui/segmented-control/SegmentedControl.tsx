import './SegmentedControl.css';

import type { CSSProperties, ReactNode } from 'react';
import { usePress } from '../buttons/pressable/usePress';

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
};

/* Its own component because usePress is a hook and the options are a map. */
const SegmentedOptionButton = ({
  selected,
  label,
  onSelect,
}: {
  selected: boolean;
  label: ReactNode;
  onSelect: () => void;
}) => {
  const press = usePress();

  return (
    <button
      ref={press.ref}
      className={[
        press.className,
        'segmented-option',
        selected ? 'segmented-option-selected' : null,
      ]
        .filter(Boolean)
        .join(' ')}
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      onPointerDown={press.onPointerDown}
      onPointerUp={press.onPointerUp}
      onPointerCancel={press.onPointerCancel}
      onPointerLeave={press.onPointerLeave}
    >
      {label}
    </button>
  );
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
        <SegmentedOptionButton
          key={option.value}
          selected={option.value === value}
          label={option.label}
          onSelect={() => onChange(option.value)}
        />
      ))}
    </div>
  );
};
