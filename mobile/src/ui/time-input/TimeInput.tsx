import './TimeInput.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { TIME_INPUT_PANEL, WHEEL_FEEL } from '../../config/wheelFeel';
import {
  parseDuration,
  parseTimeOfDay,
  serializeDuration,
  serializeTimeOfDay,
} from '../../system/helpers/dateTimeSerializers';
import { isCoarsePointer } from '../../system/helpers/pointerKind';
import { Wheel } from '../wheel/Wheel';
import {
  applyColumn,
  buildColumns,
  clampToScale,
  snapTo,
  toTotalMinutes,
  toValue,
} from './timeInputLogic';
import type { PickerMode, TimeInputValue, TimeScale } from './timeInputLogic';

type TimeInputProps = {
  mode: PickerMode;
  scale: TimeScale;
  value: TimeInputValue | null;
  onChange: (value: TimeInputValue) => void;
  label: string;
  placeholder?: string;
  defaultValue?: TimeInputValue;
  className?: string;
};

const serialize = (value: TimeInputValue) =>
  value.time === null
    ? serializeDuration(value.durationMinutes)
    : serializeTimeOfDay(value.time);

type TimeWheelsProps = {
  mode: PickerMode;
  scale: TimeScale;
  value: TimeInputValue | null;
  onChange: (value: TimeInputValue) => void;
  open: boolean;
  defaultValue?: TimeInputValue;
};

// The wheels panel alone, split out so a form can anchor it somewhere other
// than directly under this component's own field — the time components block
// opens one shared panel under a whole row of fields.
export const TimeWheels = ({
  mode,
  scale,
  value,
  onChange,
  open,
  defaultValue,
}: TimeWheelsProps) => {
  const [lingering, setLingering] = useState(false);
  const mounted = open || lingering;

  useEffect(() => {
    if (open) {
      setLingering(true);
      return;
    }

    const timer = setTimeout(
      () => setLingering(false),
      TIME_INPUT_PANEL.durationMs,
    );

    return () => clearTimeout(timer);
  }, [open]);

  const stored = value === null ? null : toTotalMinutes(value);
  const fallback =
    defaultValue === undefined ? scale.min : toTotalMinutes(defaultValue);
  const total = snapTo(scale, stored ?? fallback);

  const columns = useMemo(
    () => buildColumns(mode, scale, total),
    [mode, scale, total],
  );

  return (
    <div
      className={
        open ? 'time-input-wheels time-input-wheels-open' : 'time-input-wheels'
      }
      aria-hidden={!open}
      style={
        {
          '--wheel-item-height': `${WHEEL_FEEL.itemHeight}px`,
          '--wheel-rows': WHEEL_FEEL.visibleRows,
          '--time-input-panel-duration': `${TIME_INPUT_PANEL.durationMs}ms`,
        } as CSSProperties
      }
    >
      {mounted && (
        <>
          <span className="time-input-pill" aria-hidden="true" />

          {columns.map((column) => (
            <Wheel
              key={column.key}
              options={column.options}
              value={column.value}
              label={column.label}
              unit={column.unit}
              onChange={(next) =>
                onChange(
                  toValue(mode, applyColumn(scale, total, column.key, next)),
                )
              }
            />
          ))}
        </>
      )}
    </div>
  );
};

export const TimeInput = ({
  mode,
  scale,
  value,
  onChange,
  label,
  placeholder = 'Not set',
  defaultValue,
  className,
}: TimeInputProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [typed, setTyped] = useState<string | null>(null);
  const editable = !isCoarsePointer();
  const root = useRef<HTMLDivElement>(null);

  // A field low on the page would otherwise open its wheels below the fold, and
  // reaching them means scrolling, which dismisses them — so they could not be
  // used at all.
  //
  // The reveal rides the expansion instead of firing at points during it. Each
  // frame asks for the least scroll that shows the panel *as it is right now*,
  // which is a few pixels, so the page travels in lockstep with the panel
  // rather than jumping. Doing it at the start and again at the end gave two
  // visible scrolls, and for the last field on a page the first of them could
  // do nothing at all: the page is already at its end, and the room to scroll
  // into only comes into existence as the panel grows into it. Following the
  // growth gets that room frame by frame as it appears.
  useEffect(() => {
    if (!isOpen) return;

    const started = performance.now();
    let frame = requestAnimationFrame(function follow() {
      root.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });

      if (performance.now() - started < TIME_INPUT_PANEL.durationMs) {
        frame = requestAnimationFrame(follow);
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  // Touching or focusing anything outside the field puts the wheels away.
  // Capture phase throughout, so it still fires for a control that stops
  // propagation on the way up.
  useEffect(() => {
    if (!isOpen) return;

    let armed = false;

    const inside = (event: Event) =>
      event.target instanceof Node && root.current?.contains(event.target);

    // Closing collapses the panel, which moves every field below it. A browser
    // resolves a click from where the pointer sits at pointerup, so a field
    // that slid upward mid-gesture is no longer under the finger and never
    // receives the click that would open it — the reason tapping a field below
    // an open panel used to need two presses, while one above worked first
    // time. So the outside touch is only noted here and acted on once the
    // gesture is over and the layout can move without stranding it.
    const noticePointerDown = (event: Event) => {
      armed = !inside(event);
    };

    const closeAfterGesture = () => {
      if (!armed) return;
      armed = false;
      setIsOpen(false);
    };

    // Tabbing away has no gesture to wait for. A focus change that belongs to
    // a pointer gesture is already spoken for above.
    const closeOnFocusElsewhere = (event: Event) => {
      if (armed || inside(event)) return;
      setIsOpen(false);
    };

    document.addEventListener('pointerdown', noticePointerDown, true);
    document.addEventListener('pointerup', closeAfterGesture, true);
    document.addEventListener('pointercancel', closeAfterGesture, true);
    document.addEventListener('focusin', closeOnFocusElsewhere, true);

    return () => {
      document.removeEventListener('pointerdown', noticePointerDown, true);
      document.removeEventListener('pointerup', closeAfterGesture, true);
      document.removeEventListener('pointercancel', closeAfterGesture, true);
      document.removeEventListener('focusin', closeOnFocusElsewhere, true);
    };
  }, [isOpen]);

  // Typing wins over the value while the caret is in the field, so the text
  // does not fight back mid-edit; committing or leaving hands control back.
  // A typed value is kept as typed, only held inside the scale's range. The
  // step grid is how finely the wheel can be pointed, not what the field is
  // allowed to hold — rounding 47h 20m to 47h 15m would throw away something
  // the user actually meant for a reason that is purely about drawing. The
  // wheel then shows the nearest row it can, the same as it already does for a
  // value stored off-grid by anything else.
  const commit = (text: string) => {
    setTyped(null);

    if (mode === 'duration') {
      const minutes = parseDuration(text);
      // Unreadable text is discarded rather than guessed at: the field falls
      // back to the value it already held.
      if (minutes !== null)
        onChange(toValue(mode, clampToScale(scale, minutes)));
      return;
    }

    const time = parseTimeOfDay(text);
    if (time === null) return;

    onChange(toValue(mode, clampToScale(scale, time.hour * 60 + time.minute)));
  };

  const shown = value === null ? '' : serialize(value);

  return (
    <div
      ref={root}
      className={className ? `time-input ${className}` : 'time-input'}
    >
      {editable ? (
        <input
          className={
            isOpen
              ? 'time-input-field time-input-field-open'
              : 'time-input-field'
          }
          type="text"
          inputMode="numeric"
          aria-label={label}
          aria-expanded={isOpen}
          placeholder={placeholder}
          value={typed ?? shown}
          onChange={(event) => setTyped(event.target.value)}
          onFocus={() => setIsOpen(true)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit(event.currentTarget.value);
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              setTyped(null);
              setIsOpen(false);
            }
          }}
        />
      ) : (
        <button
          className={
            isOpen
              ? 'time-input-field time-input-field-open'
              : 'time-input-field'
          }
          type="button"
          aria-label={label}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
        >
          {value === null ? (
            <span className="time-input-placeholder">{placeholder}</span>
          ) : (
            shown
          )}
        </button>
      )}

      <TimeWheels
        mode={mode}
        scale={scale}
        value={value}
        onChange={onChange}
        open={isOpen}
        defaultValue={defaultValue}
      />
    </div>
  );
};
