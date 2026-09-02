import './pickers.css';

import { useId, useMemo } from 'react';
import '@mobiscroll/react/dist/css/mobiscroll.min.css';
import { Datepicker } from '@mobiscroll/react';
import type { MbscDatepickerChangeEvent } from '@mobiscroll/react/dist/src/core/components/datepicker/datepicker.types.public';
import type { Temporal } from 'temporal-polyfill';
import { WEEK_STARTS_ON } from '../../config/calendarPreferences';
import { SLOT_FLEXIBLE_TIME, TIME_OF_DAY } from '../../config/timeScales';
import { serializeDuration } from '../../system/helpers/dateTimeSerializers';
import { fromJsDate, toJsDate } from '../../system/helpers/helpers';
import { FieldShell } from '../../ui/text-field/FieldShell';
import { Reveal } from '../../ui/reveal/Reveal';
import { TimeWheels } from '../../ui/time-input/TimeInput';
import type {
  TimeInputValue,
  TimeScale,
} from '../../ui/time-input/timeInputLogic';
import { slotDurationMinutes } from './timeComponents/timeComponentsState';

type PickerTriggerProps = {
  label: string;
  text: string | null;
  open: boolean;
  onPress: () => void;
  placeholder?: string;
  className?: string;
  /** A small marker after the value — "+1" on a next-day end. */
  badge?: string;
  /** Names the trigger element. A form that has to reach a field it did not
      render — to scroll to it, or to mark it — addresses it by this. */
  id?: string;
};

export const PickerTrigger = ({
  label,
  text,
  open,
  onPress,
  placeholder = 'Not set',
  className,
  badge,
  id,
}: PickerTriggerProps) => {
  const generatedId = `picker-${useId().replace(/[^\w-]/g, '')}`;
  const controlId = id ?? generatedId;

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
        {badge && <span className="picker-badge">{badge}</span>}
      </button>
    </FieldShell>
  );
};

const asTime = (time: Temporal.PlainTime | null): TimeInputValue | null =>
  time ? { time, durationMinutes: null } : null;

const minutesOf = (time: Temporal.PlainTime) => time.hour * 60 + time.minute;

// The wheel only lists what may be picked, so an end constrained by its start
// simply starts its scale one minute later — the grid then lands on the next
// step the wheel can draw. A start constrained by its end stops one minute
// short of it, the same move in the other direction.
const boundedTimeScale = (
  notBefore: Temporal.PlainTime | null | undefined,
  notAfter: Temporal.PlainTime | null | undefined,
) => ({
  ...TIME_OF_DAY,
  min: notBefore ? minutesOf(notBefore) + 1 : TIME_OF_DAY.min,
  wheelMax: notAfter ? minutesOf(notAfter) - 1 : TIME_OF_DAY.wheelMax,
});

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
}: InlineTimeRangePanelProps) => (
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
        <div className="time-picker-group-head">
          <span className="time-picker-group-label">End</span>
          {from && to && (
            <span className="time-picker-duration">
              Duration:{' '}
              <span className="time-picker-duration-value">
                {serializeDuration(slotDurationMinutes(from, to))}
              </span>
            </span>
          )}
        </div>
        <TimeWheels
          mode="time"
          scale={TIME_OF_DAY}
          value={asTime(to)}
          onChange={({ time }) => time && onTo(time)}
          open
          defaultValue={
            asTime(from ? from.add({ hours: 1 }) : null) ?? undefined
          }
          windowStart={from ? from.hour * 60 + from.minute : undefined}
        />
      </div>
    </div>
  </Reveal>
);

/* The panel's own action, in the panel's top-right corner rather than on a
   line of its own — see pickers.css for what each panel gives up to host it.

   Right-hand side, and that is the point of it: the panel opens directly
   beneath the trigger that was just tapped and stays live while it animates,
   so an action under that spot is one a second tap can hit. A trigger never
   sits at this end of the row.

   Rendered only when there is something to clear — the same choice the slot row
   makes for its delete button, since a control that is usually disabled is
   noise. Its accessible name is just the word: only one panel is ever live,
   because a closed Reveal is inert, so there is nothing to confuse it with. */
const PanelClear = ({ onClear }: { onClear: () => void }) => (
  <button className="picker-clear" type="button" onClick={onClear}>
    Clear
  </button>
);

type InlineTimePanelProps = {
  open: boolean;
  value: Temporal.PlainTime | null;
  /* `null` is the field being cleared, which only a clearable panel emits. */
  onChange: (time: Temporal.PlainTime | null) => void;
  notBefore?: Temporal.PlainTime | null;
  notAfter?: Temporal.PlainTime | null;
  /* Off by default: a required field has no empty state to offer. */
  clearable?: boolean;
};

export const InlineTimePanel = ({
  open,
  value,
  onChange,
  notBefore = null,
  notAfter = null,
  clearable = false,
}: InlineTimePanelProps) => {
  const scale = useMemo(
    () => boundedTimeScale(notBefore, notAfter),
    [notBefore, notAfter],
  );

  return (
    <Reveal when={open} intoView>
      <div className="time-picker-panel time-picker-panel-single">
        {clearable && value !== null && (
          <PanelClear onClear={() => onChange(null)} />
        )}
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
  scale?: TimeScale;
};

export const InlineDurationPanel = ({
  open,
  minutes,
  onChange,
  scale = SLOT_FLEXIBLE_TIME,
}: InlineDurationPanelProps) => (
  <Reveal when={open} intoView>
    <div className="time-picker-panel time-picker-panel-single">
      <TimeWheels
        mode="duration"
        scale={scale}
        value={
          minutes === null ? null : { time: null, durationMinutes: minutes }
        }
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
  /* `null` is the field being cleared, which only a clearable panel emits. */
  onChange: (date: Temporal.PlainDate | null) => void;
  min?: Temporal.PlainDate | null;
  max?: Temporal.PlainDate | null;
  /* Off by default: a required field has no empty state to offer. */
  clearable?: boolean;
};

export const InlineDatePanel = ({
  open,
  value,
  onChange,
  min = null,
  max = null,
  clearable = false,
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
        {clearable && value !== null && (
          <PanelClear onClear={() => onChange(null)} />
        )}
        <Datepicker
          select="date"
          controls={['calendar']}
          display="inline"
          // Without this, an inline picker mounted over a null value selects
          // today by itself and fires onChange for it — the panel then commits
          // a date nobody picked and closes before it has ever been seen.
          defaultSelection={null}
          min={min ? toJsDate(min) : undefined}
          max={max ? toJsDate(max) : undefined}
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
