import './ChromeComparison.css';

import { useState } from 'react';
import { Field } from '../ui/text-field/Field';
import { TimeInput } from '../ui/time-input/TimeInput';
import type {
  TimeInputValue,
  TimeScale,
} from '../ui/time-input/timeInputLogic';
import { hours } from '../ui/time-input/timeInputLogic';

const DURATION_SCALE: TimeScale = {
  min: 0,
  wheelMax: hours(8),
  bands: [{ from: 0, step: 15 }],
};

const SAMPLE = 'Roof on before the rain.\nDoor that shuts.';

export const ChromeComparison = () => {
  const [duration, setDuration] = useState<TimeInputValue>({
    time: null,
    durationMinutes: 90,
  });
  const [hairline, setHairline] = useState(SAMPLE);
  const [boxed, setBoxed] = useState(SAMPLE);
  const [hairlineShort, setHairlineShort] = useState('Rebuild the shed');
  const [boxedShort, setBoxedShort] = useState('Rebuild the shed');

  return (
    <div className="chrome-comparison">
      <h2 className="chrome-comparison-title">Rest chrome, side by side</h2>

      <section className="chrome-comparison-row">
        <p className="chrome-comparison-note">
          TimeInput, as it ships today — a full box in --border-control, fixed
          --control-height, no visible label
        </p>
        <TimeInput
          mode="duration"
          scale={DURATION_SCALE}
          value={duration}
          onChange={setDuration}
          label="Duration"
        />
      </section>

      <section className="chrome-comparison-row">
        <p className="chrome-comparison-note">
          Field, as built — bottom hairline in --separator, fills on focus,
          label above, grows with the text
        </p>
        <Field
          label="Name"
          value={hairlineShort}
          onChange={setHairlineShort}
          allowNewlines={false}
        />
        <Field label="Goal" value={hairline} onChange={setHairline} />
      </section>

      <section className="chrome-comparison-row">
        <p className="chrome-comparison-note">
          Field wearing TimeInput&apos;s chrome — the same text control boxed,
          so the only variable is the border
        </p>
        <Field
          className="field-boxed"
          label="Name"
          value={boxedShort}
          onChange={setBoxedShort}
          allowNewlines={false}
        />
        <Field
          className="field-boxed"
          label="Goal"
          value={boxed}
          onChange={setBoxed}
        />
      </section>
    </div>
  );
};
