import './CheckboxSpecimens.css';

import { useState } from 'react';
import { PROJECT_TOTAL_TIME } from '../config/timeScales';
import { Checkbox } from '../ui/checkbox/Checkbox';
import { Reveal } from '../ui/reveal/Reveal';
import { SegmentedControl } from '../ui/segmented-control/SegmentedControl';
import type { SegmentedOption } from '../ui/segmented-control/SegmentedControl';
import { TimeInput } from '../ui/time-input/TimeInput';
import type { TimeInputValue } from '../ui/time-input/timeInputLogic';

type Repetitions = '1' | '2' | '3';

const REPETITION_OPTIONS: SegmentedOption<Repetitions>[] = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
];

const LONG_LABEL =
  'A label long enough that it has to wrap onto a second line while whatever ' +
  'it reveals stays where it belongs, out at the right edge of the row';

const duration = (minutes: number): TimeInputValue => ({
  time: null,
  durationMinutes: minutes,
});

export const CheckboxSpecimens = () => {
  const [timed, setTimed] = useState(false);
  const [dividable, setDividable] = useState(true);
  const [repeating, setRepeating] = useState(false);
  const [wordy, setWordy] = useState(false);
  const [noted, setNoted] = useState(false);

  const [total, setTotal] = useState<TimeInputValue | null>(duration(90));
  const [minBlock, setMinBlock] = useState<TimeInputValue | null>(duration(60));
  const [repetitions, setRepetitions] = useState<Repetitions>('1');

  return (
    <div className="checkbox-specimens">
      <section className="checkbox-specimen">
        <p className="checkbox-specimen-note">the sketch</p>

        <div className="checkbox-row">
          <Checkbox
            checked={timed}
            onChange={setTimed}
            label="Time needed target"
          />
          <Reveal when={timed} axis="inline">
            <TimeInput
              mode="duration"
              scale={PROJECT_TOTAL_TIME}
              value={total}
              onChange={setTotal}
              label="Time needed"
            />
          </Reveal>
        </div>

        <Reveal when={timed}>
          <div className="checkbox-row checkbox-row-indent">
            <Checkbox
              checked={dividable}
              onChange={setDividable}
              label="Dividable"
            />
            <Reveal when={dividable} axis="inline">
              <span className="checkbox-specimen-aside">– min block</span>
              <TimeInput
                mode="duration"
                scale={PROJECT_TOTAL_TIME}
                value={minBlock}
                onChange={setMinBlock}
                label="Minimum block"
              />
            </Reveal>
          </div>
        </Reveal>

        <div className="checkbox-row">
          <Checkbox
            checked={repeating}
            onChange={setRepeating}
            label="Repetitions needed target"
          />
          <Reveal when={repeating} axis="inline">
            <SegmentedControl
              options={REPETITION_OPTIONS}
              value={repetitions}
              onChange={setRepetitions}
              label="Repetitions"
            />
          </Reveal>
        </div>
      </section>

      <section className="checkbox-specimen">
        <p className="checkbox-specimen-note">a label that has to wrap</p>

        <div className="checkbox-row">
          <Checkbox checked={wordy} onChange={setWordy} label={LONG_LABEL} />
          <Reveal when={wordy} axis="inline">
            <SegmentedControl
              options={REPETITION_OPTIONS}
              value={repetitions}
              onChange={setRepetitions}
              label="Repetitions, again"
            />
          </Reveal>
        </div>
      </section>

      <section className="checkbox-specimen">
        <p className="checkbox-specimen-note">
          text revealed below, not beside
        </p>

        <div className="checkbox-row">
          <Checkbox
            checked={noted}
            onChange={setNoted}
            label="Explain what this does"
          />
        </div>
        <Reveal when={noted}>
          <p className="checkbox-specimen-prose">
            Anything can be revealed, not only a control — this paragraph is
            several lines long precisely so the height it expands to is not a
            number anybody could have guessed in advance.
          </p>
        </Reveal>
      </section>

      <section className="checkbox-specimen">
        <p className="checkbox-specimen-note">
          nothing depends on it, and two that cannot be touched
        </p>

        <div className="checkbox-row">
          <Checkbox
            checked={false}
            onChange={() => {}}
            label="Disabled, unticked"
            disabled
          />
        </div>
        <div className="checkbox-row">
          <Checkbox
            checked
            onChange={() => {}}
            label="Disabled, ticked"
            disabled
          />
        </div>
      </section>
    </div>
  );
};
