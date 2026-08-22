import './ShapeVariants.css';

import { useState } from 'react';
import { ToggleGroup } from '../ui/toggle-group/ToggleGroup';

type Weekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';

const WEEKDAYS = [
  { value: 'MO' as const, label: 'Mo' },
  { value: 'TU' as const, label: 'Tu' },
  { value: 'WE' as const, label: 'We' },
  { value: 'TH' as const, label: 'Th' },
  { value: 'FR' as const, label: 'Fr' },
  { value: 'SA' as const, label: 'Sa' },
  { value: 'SU' as const, label: 'Su' },
];

// Each is the same primitive with different values for --toggle-option-size and
// --toggle-option-radius. Nothing here overrides behaviour, so what is being
// compared really is only the shape.
const VARIANTS = [
  {
    id: 'a',
    name: 'A · circle 30',
    note: 'today — 44px hit area, All inline',
    withAll: true,
  },
  {
    id: 'b',
    name: 'B · circle 36',
    note: 'drawn larger — measured: does NOT fit with All inline, overflows 19px at 375px',
    withAll: false,
  },
  {
    id: 'c',
    name: 'C · squircle 36, r 12',
    note: 'between a square and a circle',
    withAll: false,
  },
  {
    id: 'd',
    name: 'D · rounded square 36, r 8',
    note: 'squarer still',
    withAll: false,
  },
  {
    id: 'e',
    name: 'E · circle 44',
    note: 'the full touch target, drawn as well as hit',
    withAll: false,
  },
  {
    id: 'f',
    name: 'F · squircle 44, r 14',
    note: 'full target, softened square',
    withAll: false,
  },
];

const Specimen = ({ id, name, note, withAll }: (typeof VARIANTS)[number]) => {
  const [days, setDays] = useState<Weekday[]>(['TU', 'TH']);

  return (
    <div className="shape-variant">
      <p className="shape-variant-name">{name}</p>
      <p className="shape-variant-note">{note}</p>

      {!withAll && (
        <button
          className="shape-variant-all"
          type="button"
          onClick={() =>
            setDays(
              days.length === WEEKDAYS.length
                ? []
                : WEEKDAYS.map((day) => day.value),
            )
          }
        >
          {days.length === WEEKDAYS.length ? 'Clear all' : 'Select all'}
        </button>
      )}

      <ToggleGroup
        className={`shape-${id}`}
        options={WEEKDAYS}
        values={days}
        onChange={setDays}
        label={`Days of the week, ${name}`}
        selectAllLabel={withAll ? 'All' : undefined}
      />
    </div>
  );
};

export const ShapeVariants = () => (
  <div className="shape-variants">
    <h2 className="shape-variants-heading">Shapes — tap each one</h2>
    <p className="shape-variants-lede">
      All of them have the same 44px-tall hit area whatever is drawn, so what
      differs is how they look and how wide the target is. Only A keeps All on
      the row: measured at 375px, anything above ~32px overflows beside it, so
      B–F move it to its own line and that is what buys the bigger shapes.
    </p>

    {VARIANTS.map((variant) => (
      <Specimen key={variant.id} {...variant} />
    ))}
  </div>
);
