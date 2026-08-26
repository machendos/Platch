import { useId, useMemo } from 'react';
import '@mobiscroll/react/dist/css/mobiscroll.min.css';
import { Datepicker } from '@mobiscroll/react';
import type { MbscDatepickerChangeEvent } from '@mobiscroll/react/dist/src/core/components/datepicker/datepicker.types.public';
import type { Temporal } from 'temporal-polyfill';
import { WEEK_STARTS_ON } from '../../../config/calendarPreferences';
import { SLOT_FLEXIBLE_TIME, TIME_OF_DAY } from '../../../config/timeScales';
import { fromJsDate, toJsDate } from '../../../system/helpers/helpers';
import { FieldShell } from '../../../ui/text-field/FieldShell';
import { Reveal } from '../../../ui/reveal/Reveal';
import { TimeWheels } from '../../../ui/time-input/TimeInput';
import type { TimeInputValue } from '../../../ui/time-input/timeInputLogic';

type PickerTriggerProps = {
  label: string;
  text: string | null;
  open: boolean;
  onPress: () => void;
  placeholder?: string;
  className?: string;
};

export const PickerTrigger = ({
  label,
  text,
  open,
  onPress,
  placeholder = 'Not set',
  className,
}: PickerTriggerProps) => {
  const controlId = `picker-${useId().replace(/[^\w-]/g, '')}`;

  return (
    <FieldShell
      controlId={controlId}
      className={[open ? 'picker picker-open' : 'picker', className]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        id={controlId}
        className="picker-field"
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={onPress}
      >
        {text ?? <span className="picker-placeholder">{placeholder}</span>}
      </button>
    </FieldShell>
  );
};

const asTime = (time: Temporal.PlainTime | null): TimeInputValue | null =>
  time ? { time, durationMinutes: null } : null;

// The wheel only lists what may be picked, so an end constrained by its start
// simply starts its scale one minute later — the grid then lands on the next
// step the wheel can draw.
const afterTimeScale = (start: Temporal.PlainTime | null | undefined) =>
  start
    ? { ...TIME_OF_DAY, min: start.hour * 60 + start.minute + 1 }
    : TIME_OF_DAY;

type InlineTimeRangePanelProps = {
  open: boolean;
  from: Temporal.PlainTime | null;
  to: Temporal.PlainTime | null;
  onFrom: (time: Temporal.PlainTime) => void;
  onTo: (time: Temporal.PlainTime) => void;
};

export const InlineTimeRangePanel = ({
  open,
  from,
  to,
  onFrom,
  onTo,
}: InlineTimeRangePanelProps) => {
  const endScale = useMemo(() => afterTimeScale(from), [from]);

  return (
    <Reveal when={open} intoView>
      <div className="time-picker-panel time-picker-panel-dual">
        <div className="time-picker-group">
          <span className="time-picker-group-label">Start</span>
          <TimeWheels
            mode="time"
            scale={TIME_OF_DAY}
            value={asTime(from)}
            onChange={({ time }) => time && onFrom(time)}
            open
          />
        </div>
        <div className="time-picker-group">
          <span className="time-picker-group-label">End</span>
          <TimeWheels
            mode="time"
            scale={endScale}
            value={asTime(to)}
            onChange={({ time }) => time && onTo(time)}
            open
            defaultValue={
              asTime(from ? from.add({ hours: 1 }) : null) ?? undefined
            }
          />
        </div>
      </div>
    </Reveal>
  );
};

type InlineTimePanelProps = {
  open: boolean;
  value: Temporal.PlainTime | null;
  onChange: (time: Temporal.PlainTime) => void;
  notBefore?: Temporal.PlainTime | null;
};

export const InlineTimePanel = ({
  open,
  value,
  onChange,
  notBefore = null,
}: InlineTimePanelProps) => {
  const scale = useMemo(() => afterTimeScale(notBefore), [notBefore]);

  return (
    <Reveal when={open} intoView>
      <div className="time-picker-panel">
        <TimeWheels
          mode="time"
          scale={scale}
          value={asTime(value)}
          onChange={({ time }) => time && onChange(time)}
          open
        />
      </div>
    </Reveal>
  );
};

type InlineDurationPanelProps = {
  open: boolean;
  minutes: number | null;
  onChange: (minutes: number) => void;
};

export const InlineDurationPanel = ({
  open,
  minutes,
  onChange,
}: InlineDurationPanelProps) => (
  <Reveal when={open} intoView>
    <div className="time-picker-panel">
      <TimeWheels
        mode="duration"
        scale={SLOT_FLEXIBLE_TIME}
        value={minutes === null ? null : { time: null, durationMinutes: minutes }}
        onChange={({ durationMinutes }) =>
          durationMinutes !== null && onChange(durationMinutes)
        }
        open
      />
    </div>
  </Reveal>
);

type InlineDatePanelProps = {
  open: boolean;
  value: Temporal.PlainDate | null;
  onChange: (date: Temporal.PlainDate) => void;
  min?: Temporal.PlainDate | null;
};

export const InlineDatePanel = ({
  open,
  value,
  onChange,
  min = null,
}: InlineDatePanelProps) => {
  const handleChange = ({ value: picked }: MbscDatepickerChangeEvent) => {
    if (!(picked instanceof Date)) return;

    onChange(fromJsDate(picked));
  };

  return (
    // keepMounted: the inline calendar's mount is the second of init the user
    // feels on every open otherwise — pay it once, behind the edit reveal.
    <Reveal when={open} intoView keepMounted>
      <div className="time-picker-panel time-picker-panel-calendar">
        <Datepicker
          select="date"
          controls={['calendar']}
          display="inline"
          // Without this, an inline picker mounted over a null value selects
          // today by itself and fires onChange for it — the panel then commits
          // a date nobody picked and closes before it has ever been seen.
          defaultSelection={null}
          min={min ? toJsDate(min) : undefined}
          firstDay={WEEK_STARTS_ON}
          theme="ios"
          themeVariant="light"
          value={value ? toJsDate(value) : null}
          onChange={handleChange}
        />
      </div>
    </Reveal>
  );
};
