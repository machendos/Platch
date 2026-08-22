import './PickerSpecimens.css';

import { useState } from 'react';
import { Temporal } from 'temporal-polyfill';
import { DateInput } from '../ui/date-input/DateInput';
import { ToggleGroup } from '../ui/toggle-group/ToggleGroup';
import { SegmentedControl } from '../ui/segmented-control/SegmentedControl';
import { ShapeVariants } from './ShapeVariants';

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

const FREQUENCIES = [
  { value: 'DAY' as const, label: 'day' },
  { value: 'WEEK' as const, label: 'week' },
  { value: 'MONTH' as const, label: 'month' },
  { value: 'YEAR' as const, label: 'year' },
];

type Frequency = (typeof FREQUENCIES)[number]['value'];

export const PickerSpecimens = () => {
  const [from, setFrom] = useState<Temporal.PlainDate | null>(
    Temporal.PlainDate.from('2026-06-19'),
  );
  const [to, setTo] = useState<Temporal.PlainDate | null>(null);
  const [distant, setDistant] = useState<Temporal.PlainDate | null>(
    Temporal.PlainDate.from('2028-11-30'),
  );

  const [days, setDays] = useState<Weekday[]>(['TU']);
  const [frequency, setFrequency] = useState<Frequency>('WEEK');

  return (
    <div className="picker-specimens">
      <h2 className="picker-specimens-heading">Dates</h2>

      <div className="picker-specimens-row">
        <span className="picker-specimens-label">From</span>
        <DateInput value={from} onChange={setFrom} label="Start date" />
      </div>

      <div className="picker-specimens-row">
        <span className="picker-specimens-label">To</span>
        <DateInput
          value={to}
          onChange={setTo}
          label="End date"
          placeholder="Pick a date"
        />
      </div>

      <div className="picker-specimens-row">
        <span className="picker-specimens-label">Other year</span>
        <DateInput value={distant} onChange={setDistant} label="Distant date" />
      </div>

      <h2 className="picker-specimens-heading">Sets</h2>

      <div className="picker-specimens-row">
        <span className="picker-specimens-label">every</span>
        <SegmentedControl
          options={FREQUENCIES}
          value={frequency}
          onChange={setFrequency}
          label="Frequency"
        />
      </div>

      <div className="picker-specimens-row picker-specimens-row-wide">
        <span className="picker-specimens-label">on</span>
        <ToggleGroup
          options={WEEKDAYS}
          values={days}
          onChange={setDays}
          label="Days of the week"
          selectAllLabel="All"
        />
      </div>

      <p className="picker-specimens-readout">
        every {frequency.toLowerCase()} on {days.join(', ') || '—'}
      </p>

      <ShapeVariants />
    </div>
  );
};
