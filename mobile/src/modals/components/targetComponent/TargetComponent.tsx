import './TargetComponent.css';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PROJECT_TOTAL_TIME } from '../../../config/timeScales';
import {
  serializeDate,
  serializeDuration,
  serializeTimeOfDay,
} from '../../../system/helpers/dateTimeSerializers';
import { Checkbox } from '../../../ui/checkbox/Checkbox';
import { Reveal } from '../../../ui/reveal/Reveal';
import { Select } from '../../../ui/select/Select';
import { numberRange } from '../../../ui/select/selectOptions';
import {
  InlineDatePanel,
  InlineDurationPanel,
  InlineTimePanel,
  PickerTrigger,
} from '../pickers';
import { useOutsideClose } from '../useOutsideClose';
import {
  TARGET_FIELD_IDS,
  buildReport,
  canDivide,
  defaultMinBlock,
  minBlockScale,
  normalizeTarget,
  openState,
  boundLimits,
  withBound,
  withMinBlock,
  withMode,
  withRepetitions,
  withTimeNeeded,
} from './targetState';
import type { TargetBound, TargetDraft, TargetReport } from './targetState';

type TargetComponentProps = {
  initial: TargetDraft;
  defaultEvenLengthMinutes: number;
  onChange: (report: TargetReport) => void;
};

const REPETITION_OPTIONS = numberRange(1, 99);

type OpenPicker = 'time' | 'block' | TargetBound | null;

/* Two bounds, four fields, one row each. `Earliest` and `Deadline` rather
   than `From` and `To`: the time components below say when the work
   *happens*, and these say the window it has to happen inside — a different
   kind of statement, which should not borrow the same words. */
const BOUNDS = [
  {
    label: 'Earliest',
    end: 'earliest',
    date: 'earliestDate',
    time: 'earliestTime',
  },
  {
    label: 'Deadline',
    end: 'deadline',
    date: 'deadlineDate',
    time: 'deadlineTime',
  },
] as const;

export const TargetComponent = ({
  initial,
  defaultEvenLengthMinutes,
  onChange,
}: TargetComponentProps) => {
  const [baseline] = useState(() => normalizeTarget(initial));
  const [state, setState] = useState(() => openState(initial));
  const [openPicker, setOpenPicker] = useState<OpenPicker>(null);
  const root = useRef<HTMLDivElement>(null);

  const closePicker = useCallback(() => setOpenPicker(null), []);
  useOutsideClose(root, openPicker !== null, closePicker);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    onChangeRef.current(buildReport(state, baseline));
  }, [state, baseline]);

  const { timeNeededMinutes, minBlockMinutes, repetitionsNeeded } = state.value;

  const blockScale = useMemo(
    () => minBlockScale(timeNeededMinutes),
    [timeNeededMinutes],
  );

  const wantsTime = state.mode === 'time';
  const dividable = minBlockMinutes !== null;

  const toggle = (picker: Exclude<OpenPicker, null>) =>
    setOpenPicker((current) => (current === picker ? null : picker));

  /* Ticking a targetComponent opens its wheels only when there is nothing to show. A
     targetComponent switched back to already holds what it held before, and opening the
     panel over an answered field asks a question that has been answered. */
  const setTimeWanted = (wanted: boolean) => {
    const next = withMode(
      state,
      wanted ? 'time' : 'none',
      defaultEvenLengthMinutes,
    );
    setState(next);
    setOpenPicker(
      wanted && next.value.timeNeededMinutes === null ? 'time' : null,
    );
  };

  const setRepetitionsWanted = (wanted: boolean) => {
    setState(
      withMode(
        state,
        wanted ? 'repetitions' : 'none',
        defaultEvenLengthMinutes,
      ),
    );
    closePicker();
  };

  const setDividable = (wanted: boolean) => {
    setState((current) =>
      withMinBlock(
        current,
        wanted
          ? defaultMinBlock(
              current.value.timeNeededMinutes,
              current.remembered.minBlockMinutes ?? defaultEvenLengthMinutes,
            )
          : null,
      ),
    );
    if (!wanted) closePicker();
  };

  return (
    <div className="target-block" ref={root}>
      <div className="target-row">
        <Checkbox
          checked={wantsTime}
          onChange={setTimeWanted}
          label="Time needed target"
        />
        <Reveal when={wantsTime} axis="inline">
          <PickerTrigger
            id={TARGET_FIELD_IDS.timeNeeded}
            label="Time needed"
            placeholder="How long"
            text={
              timeNeededMinutes === null
                ? null
                : serializeDuration(timeNeededMinutes)
            }
            open={openPicker === 'time'}
            onPress={() => toggle('time')}
          />
        </Reveal>
      </div>

      <InlineDurationPanel
        open={openPicker === 'time'}
        minutes={timeNeededMinutes}
        scale={PROJECT_TOTAL_TIME}
        onChange={(picked) =>
          setState((current) =>
            withTimeNeeded(current, picked, defaultEvenLengthMinutes),
          )
        }
      />

      {/* Nested one indent in: this line is about the time above it. It stays
          on screen when the total is too short to divide and goes disabled
          instead of vanishing — a line that disappears reads as a bug, where a
          greyed one says the total is what stands in the way. */}
      <Reveal when={wantsTime}>
        <div className="target-nested">
          <div className="target-row">
            <Checkbox
              checked={dividable}
              onChange={setDividable}
              label="Dividable"
              disabled={!canDivide(timeNeededMinutes)}
            />
            <Reveal when={dividable} axis="inline">
              <span className="target-row-label">— min block</span>
              <PickerTrigger
                label="Minimum block"
                placeholder="How long"
                text={
                  minBlockMinutes === null
                    ? null
                    : serializeDuration(minBlockMinutes)
                }
                open={openPicker === 'block'}
                onPress={() => toggle('block')}
              />
            </Reveal>
          </div>

          <InlineDurationPanel
            open={openPicker === 'block'}
            minutes={minBlockMinutes}
            scale={blockScale}
            onChange={(picked) =>
              setState((current) => withMinBlock(current, picked))
            }
          />
        </div>
      </Reveal>

      <div className="target-row">
        <Checkbox
          checked={state.mode === 'repetitions'}
          onChange={setRepetitionsWanted}
          label="Repetitions needed target"
        />
        <Reveal when={state.mode === 'repetitions'} axis="inline">
          <Select
            id={TARGET_FIELD_IDS.repetitions}
            className="target-repetitions"
            options={REPETITION_OPTIONS}
            value={repetitionsNeeded}
            onChange={(picked) =>
              setState((current) => withRepetitions(current, picked))
            }
            label="Repetitions needed"
            placeholder="How many"
          />
        </Reveal>
      </div>

      {/* Only once something is being aimed at: a window with no target to sit
          inside describes nothing. */}
      <Reveal when={state.mode !== 'none'}>
        <div className="target-window">
          {BOUNDS.map(({ label, end, date, time }) => {
            const limits = boundLimits(state.value, end);

            return (
              <div key={label}>
                <div className="target-row">
                  <span className="target-row-label target-row-lead">
                    {label}
                  </span>
                  <PickerTrigger
                    label={`${label} date`}
                    placeholder="Date"
                    text={
                      state.value[date]
                        ? serializeDate(state.value[date])
                        : null
                    }
                    open={openPicker === date}
                    onPress={() => toggle(date)}
                  />
                  <PickerTrigger
                    label={`${label} time`}
                    placeholder="Time"
                    text={
                      state.value[time]
                        ? serializeTimeOfDay(state.value[time])
                        : null
                    }
                    open={openPicker === time}
                    onPress={() => toggle(time)}
                  />
                </div>

                {/* Each end is offered only what the other one leaves possible,
                  so a deadline before its earliest cannot be picked at all. */}
                <InlineDatePanel
                  open={openPicker === date}
                  value={state.value[date]}
                  min={limits.minDate}
                  max={limits.maxDate}
                  clearable
                  onChange={(picked) => {
                    setState((current) => withBound(current, date, picked));
                    closePicker();
                  }}
                />
                <InlineTimePanel
                  open={openPicker === time}
                  value={state.value[time]}
                  notBefore={limits.notBefore}
                  notAfter={limits.notAfter}
                  clearable
                  onChange={(picked) => {
                    setState((current) => withBound(current, time, picked));
                    /* Picking a time leaves the wheels up to keep turning;
                       clearing closes, because a panel whose field is now
                       empty has nothing left to do. */
                    if (picked === null) closePicker();
                  }}
                />
              </div>
            );
          })}
        </div>
      </Reveal>
    </div>
  );
};
