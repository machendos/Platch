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
    note: 'the first pass — smallest of the set',
  },
  {
    id: 'b',
    name: 'B · circle 36',
    note: 'drawn larger',
  },
  {
    id: 'c',
    name: 'C · squircle 36, r 12',
    note: 'CHOSEN — between a square and a circle',
  },
  {
    id: 'd',
    name: 'D · rounded square 36, r 8',
    note: 'squarer still',
  },
  {
    id: 'e',
    name: 'E · circle 44',
    note: 'the full touch target, drawn as well as hit',
  },
  {
    id: 'f',
    name: 'F · squircle 44, r 14',
    note: 'full target, softened square',
  },
];

const Specimen = ({ id, name, note }: (typeof VARIANTS)[number]) => {
  const [days, setDays] = useState<Weekday[]>(['TU', 'TH']);

  return (
    <div className="shape-variant">
      <p className="shape-variant-name">{name}</p>
      <p className="shape-variant-note">{note}</p>

      <ToggleGroup
        className={`shape-${id}`}
        options={WEEKDAYS}
        values={days}
        onChange={setDays}
        label={`Days of the week, ${name}`}
        selectAllLabel="Select all"
        clearAllLabel="Clear all"
      />
    </div>
  );
};

export const ShapeVariants = () => (
  <div className="shape-variants">
    <h2 className="shape-variants-heading">Shapes — tap each one</h2>
    <p className="shape-variants-lede">
      All of them have the same 44px-tall hit area whatever is drawn, so what
      differs is only how they look and how wide the target is. All sits on its
      own line throughout: measured at 375px, anything above ~32px overflows
      beside it, and that second line is what buys every size above A.
    </p>

    {VARIANTS.map((variant) => (
      <Specimen key={variant.id} {...variant} />
    ))}
  </div>
);
