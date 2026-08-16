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

  // The panel element is permanent so the class toggle has two states to
  // transition between, but **the rows inside it are not**: leaving every
  // field's rows mounted multiplies the DOM across a form and puts all of them
  // through a re-render on every detent a spin crosses, which is enough to make
  // the spin itself stutter on a phone.
  const [lingering, setLingering] = useState(false);
  const mounted = isOpen || lingering;

  useEffect(() => {
    if (isOpen) {
      setLingering(true);
      return;
    }

    const timer = setTimeout(
      () => setLingering(false),
      TIME_INPUT_PANEL.durationMs,
    );

    return () => clearTimeout(timer);
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

  // A stored value is shown exactly as stored, but the wheels can only sit on
  // values the scale allows — so an off-grid one opens on its nearest neighbour
  // without being reported back. Nothing here emits until a wheel moves.
  const stored = value === null ? null : toTotalMinutes(value);
  const fallback =
    defaultValue === undefined ? scale.min : toTotalMinutes(defaultValue);
  const total = snapTo(scale, stored ?? fallback);

  // A fling reports every detent it crosses, so this runs dozens of times a
  // second during one throw; the option lists only actually change when the
  // hour does.
  const columns = useMemo(
    () => buildColumns(mode, scale, total),
    [mode, scale, total],
  );

  // Typing wins over the value while the caret is in the field, so the text
  // does not fight back mid-edit; committing or leaving hands control back.
  const commit = (text: string) => {
    setTyped(null);

    if (mode === 'duration') {
      const minutes = parseDuration(text);
      // Unreadable text is discarded rather than guessed at: the field falls
      // back to the value it already held.
      if (minutes !== null) onChange(toValue(mode, snapTo(scale, minutes)));
      return;
    }

    const time = parseTimeOfDay(text);
    if (time === null) return;

    onChange(toValue(mode, snapTo(scale, time.hour * 60 + time.minute)));
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

      <div
        className={
          isOpen
            ? 'time-input-wheels time-input-wheels-open'
            : 'time-input-wheels'
        }
        aria-hidden={!isOpen}
        // The open height is these two multiplied. Handed down because `Wheel`
        // sets them on itself, one level too deep for this element to read —
        // and a token on :root cannot do the multiplication either, since a
        // custom property resolves where it is declared and would find nothing.
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
    </div>
  );
};
