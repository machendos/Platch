import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { IonIcon } from '@ionic/react';
import { addOutline, trashOutline } from 'ionicons/icons';
import { IconButton } from '../../../ui/buttons/IconButton';
import { SegmentedControl } from '../../../ui/segmented-control/SegmentedControl';
import type { SegmentedOption } from '../../../ui/segmented-control/SegmentedControl';
import { Select } from '../../../ui/select/Select';
import { numberRange } from '../../../ui/select/selectOptions';
import type { SelectOption } from '../../../ui/select/selectOptions';
import { ToggleGroup } from '../../../ui/toggle-group/ToggleGroup';
import type { ToggleOption } from '../../../ui/toggle-group/ToggleGroup';
import {
  serializeDate,
  serializeDuration,
  serializeTimeOfDay,
} from '../../../system/helpers/dateTimeSerializers';
import { AnimatedEntry } from './AnimatedEntry';
import {
  InlineDatePanel,
  InlineDurationPanel,
  InlineTimePanel,
  InlineTimeRangePanel,
  PickerTrigger,
} from './pickers';
import {
  WEEKDAYS,
  newSlotDraft,
  slotWrapsMidnight,
  withExactFrom,
  withFrequency,
  withSlotChanged,
  withSlotFlex,
  withSlotRemoved,
  withSlotTime,
  withType,
} from './timeComponentsState';
import type {
  RecurringFrequency,
  SlotDraft,
  TimeComponentDraft,
  TimeComponentType,
  Weekday,
} from './timeComponentsState';

type TimeComponentEditorProps = {
  draft: TimeComponentDraft;
  ordinal?: number;
  onChange: (draft: TimeComponentDraft) => void;
  onDelete: () => void;
};

type OpenPicker =
  | { kind: 'from-date' | 'from-time' | 'to-date' | 'to-time' }
  | { kind: 'slot-times' | 'slot-flex'; slotKey: string }
  | null;

const samePicker = (current: OpenPicker, wanted: Exclude<OpenPicker, null>) =>
  current !== null &&
  current.kind === wanted.kind &&
  ('slotKey' in wanted
    ? 'slotKey' in current && current.slotKey === wanted.slotKey
    : true);

const TYPE_OPTIONS: SegmentedOption<TimeComponentType>[] = [
  { value: 'ABSOLUTE', label: 'Exact time' },
  { value: 'RECURRING', label: 'Recurring' },
];

const INTERVAL_OPTIONS = numberRange(1, 30);

// The row reads as a sentence, so the unit agrees with the number.
const frequencyOptions = (
  plural: boolean,
): SelectOption<RecurringFrequency>[] => [
  { value: 'DAY', label: plural ? 'days' : 'day' },
  { value: 'WEEK', label: plural ? 'weeks' : 'week' },
  { value: 'MONTH', label: plural ? 'months' : 'month' },
  { value: 'YEAR', label: plural ? 'years' : 'year' },
];

const WEEKDAY_OPTIONS: ToggleOption<Weekday>[] = WEEKDAYS.map((day) => ({
  value: day,
  label: `${day[0]}${day[1].toLowerCase()}`,
}));

const MONTH_DAY_OPTIONS = numberRange(1, 31);

const MONTH_OPTIONS: SelectOption<number>[] = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
].map((label, index) => ({ value: index + 1, label }));

const useOutsideClose = (
  root: RefObject<HTMLDivElement | null>,
  active: boolean,
  close: () => void,
) => {
  useEffect(() => {
    if (!active) return;

    let armed = false;
    let insideGesture = false;

    const inside = (event: Event) =>
      event.target instanceof Node &&
      root.current?.contains(event.target) === true;

    // Acted on at pointerup rather than pointerdown: closing collapses the
    // panel and moves everything below it, and a click resolves from where the
    // pointer sits when the gesture ends. Same rule TimeInput follows.
    const noticePointerDown = (event: Event) => {
      armed = !inside(event);
      insideGesture = !armed;
    };

    const closeAfterGesture = () => {
      insideGesture = false;
      if (!armed) return;
      armed = false;
      close();
    };

    // A focus change during a gesture that started inside is not the user
    // leaving: a mouse-down on the non-focusable wheel blurs the trigger and
    // Ionic's focus trap re-focuses the modal host — outside this editor —
    // which used to close the panel the moment a desktop drag began.
    const closeOnFocusElsewhere = (event: Event) => {
      if (armed || insideGesture || inside(event)) return;
      close();
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
  }, [root, active, close]);
};

const SlotEditor = ({
  slot,
  removable,
  open,
  onOpen,
  onChange,
  onRemove,
}: {
  slot: SlotDraft;
  removable: boolean;
  open: 'times' | 'flex' | null;
  onOpen: (kind: 'times' | 'flex') => void;
  onChange: (change: (slot: SlotDraft) => SlotDraft) => void;
  onRemove: () => void;
}) => {
  const flexOwns = slot.flexibleMinutesNeeded !== null;
  const timesOwn = slot.from !== null || slot.to !== null;

  return (
    <div className="time-slot-entry">
      <div className="time-slot-row">
        <span className="time-slot-bullet" aria-hidden="true" />
        <PickerTrigger
          label="Start time"
          text={slot.from ? serializeTimeOfDay(slot.from) : null}
          placeholder="Start"
          open={open === 'times'}
          onPress={() => onOpen('times')}
          className={flexOwns ? 'time-slot-dim' : undefined}
        />
        <span
          className={
            flexOwns
              ? 'time-component-row-label time-slot-dim'
              : 'time-component-row-label'
          }
        >
          –
        </span>
        <PickerTrigger
          label="End time"
          text={slot.to ? serializeTimeOfDay(slot.to) : null}
          placeholder="End"
          badge={slotWrapsMidnight(slot) ? '+1' : undefined}
          open={open === 'times'}
          onPress={() => onOpen('times')}
          className={flexOwns ? 'time-slot-dim' : undefined}
        />
        <span className="time-component-row-label time-slot-or">or</span>
        <PickerTrigger
          label="Flexible time needed"
          text={
            slot.flexibleMinutesNeeded !== null
              ? serializeDuration(slot.flexibleMinutesNeeded)
              : null
          }
          placeholder="Flexible"
          open={open === 'flex'}
          onPress={() => onOpen('flex')}
          className={timesOwn ? 'time-slot-dim' : undefined}
        />
        {removable && (
          <IconButton
            className="time-slot-delete"
            label="Delete time slot"
            onClick={onRemove}
          >
            <IonIcon icon={trashOutline} aria-hidden="true" />
          </IconButton>
        )}
      </div>
      <InlineTimeRangePanel
        open={open === 'times'}
        from={slot.from}
        to={slot.to}
        onFrom={(time) => onChange((slot) => withSlotTime(slot, 'from', time))}
        onTo={(time) => onChange((slot) => withSlotTime(slot, 'to', time))}
      />
      <InlineDurationPanel
        open={open === 'flex'}
        minutes={slot.flexibleMinutesNeeded}
        onChange={(minutes) => onChange((slot) => withSlotFlex(slot, minutes))}
      />
    </div>
  );
};

export const TimeComponentEditor = ({
  draft,
  ordinal,
  onChange,
  onDelete,
}: TimeComponentEditorProps) => {
  const [openPicker, setOpenPicker] = useState<OpenPicker>(null);
  const [leavingSlots, setLeavingSlots] = useState<string[]>([]);
  const spawnedSlots = useRef(new Set<string>()).current;
  const root = useRef<HTMLDivElement>(null);

  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  });

  const closePicker = useCallback(() => setOpenPicker(null), []);
  useOutsideClose(root, openPicker !== null, closePicker);

  const toggle = (wanted: Exclude<OpenPicker, null>) =>
    setOpenPicker((current) => (samePicker(current, wanted) ? null : wanted));

  const isOpen = (wanted: Exclude<OpenPicker, null>) =>
    samePicker(openPicker, wanted);

  const addSlot = () => {
    const slot = newSlotDraft();
    spawnedSlots.add(slot.key);
    onChange({ ...draft, slots: [...draft.slots, slot] });
  };

  const removeSlot = (slotKey: string) => {
    setLeavingSlots((keys) => [...keys, slotKey]);
    setOpenPicker((current) =>
      current !== null && 'slotKey' in current && current.slotKey === slotKey
        ? null
        : current,
    );
  };

  const dropSlot = (slotKey: string) => {
    setLeavingSlots((keys) => keys.filter((key) => key !== slotKey));
    onChange(withSlotRemoved(draftRef.current, slotKey));
  };

  const activeSlots = draft.slots.length - leavingSlots.length;

  return (
    <div className="time-component-editor" ref={root}>
      <div className="time-component-editor-top">
        <span className="time-component-ordinal">
          {ordinal !== undefined ? `${ordinal}.` : ''}
        </span>
        <SegmentedControl
          options={TYPE_OPTIONS}
          value={draft.type}
          onChange={(type) => {
            setOpenPicker(null);
            onChange(withType(draft, type));
          }}
          label="Time component type"
        />
        <IconButton
          className="time-component-delete"
          label="Delete time component"
          onClick={onDelete}
        >
          <IonIcon icon={trashOutline} aria-hidden="true" />
        </IconButton>
      </div>

      {draft.type === 'ABSOLUTE' ? (
        <>
          <div className="time-component-exact-row">
            <span className="time-component-row-label">From</span>
            <PickerTrigger
              label="From date"
              text={draft.fromDate ? serializeDate(draft.fromDate) : null}
              placeholder="Date"
              open={isOpen({ kind: 'from-date' })}
              onPress={() => toggle({ kind: 'from-date' })}
            />
            <PickerTrigger
              label="From time"
              text={draft.fromTime ? serializeTimeOfDay(draft.fromTime) : null}
              placeholder="Time"
              open={isOpen({ kind: 'from-time' })}
              onPress={() => toggle({ kind: 'from-time' })}
            />
          </div>
          <InlineDatePanel
            open={isOpen({ kind: 'from-date' })}
            value={draft.fromDate}
            onChange={(fromDate) => {
              onChange(withExactFrom(draft, fromDate, draft.fromTime));
              closePicker();
            }}
          />
          <InlineTimePanel
            open={isOpen({ kind: 'from-time' })}
            value={draft.fromTime}
            onChange={(fromTime) =>
              onChange(withExactFrom(draft, draft.fromDate, fromTime))
            }
          />
          <div className="time-component-exact-row">
            <span className="time-component-row-label">To</span>
            <PickerTrigger
              label="To date"
              text={draft.toDate ? serializeDate(draft.toDate) : null}
              placeholder="Date"
              open={isOpen({ kind: 'to-date' })}
              onPress={() => toggle({ kind: 'to-date' })}
            />
            <PickerTrigger
              label="To time"
              text={draft.toTime ? serializeTimeOfDay(draft.toTime) : null}
              placeholder="Time"
              open={isOpen({ kind: 'to-time' })}
              onPress={() => toggle({ kind: 'to-time' })}
            />
          </div>
          <InlineDatePanel
            open={isOpen({ kind: 'to-date' })}
            value={draft.toDate}
            min={draft.fromDate}
            onChange={(toDate) => {
              onChange({ ...draft, toDate });
              closePicker();
            }}
          />
          <InlineTimePanel
            open={isOpen({ kind: 'to-time' })}
            value={draft.toTime}
            notBefore={
              draft.fromDate !== null &&
              (draft.toDate === null || draft.toDate.equals(draft.fromDate))
                ? draft.fromTime
                : null
            }
            onChange={(toTime) => onChange({ ...draft, toTime })}
          />
        </>
      ) : (
        <>
          <div className="time-component-row">
            <span className="time-component-row-label">Repeat every</span>
            <Select
              className="time-component-interval"
              options={INTERVAL_OPTIONS}
              value={draft.interval}
              onChange={(interval) => onChange({ ...draft, interval })}
              label="Repeat interval"
            />
            <Select
              className="time-component-frequency"
              options={frequencyOptions(draft.interval > 1)}
              value={draft.frequency}
              onChange={(frequency) =>
                onChange(withFrequency(draft, frequency))
              }
              label="Repeat unit"
            />
          </div>
          {draft.frequency === 'WEEK' && (
            <div className="time-component-row time-component-on-row">
              <span className="time-component-row-label">on</span>
              <ToggleGroup
                options={WEEKDAY_OPTIONS}
                values={draft.byDay}
                onChange={(byDay) => onChange({ ...draft, byDay })}
                label="Days of the week"
                selectAllLabel="Select all"
                clearAllLabel="Clear all"
              />
            </div>
          )}
          {draft.frequency === 'MONTH' && (
            <div className="time-component-row">
              <span className="time-component-row-label">on</span>
              <Select
                options={MONTH_DAY_OPTIONS}
                value={draft.byMonthDay}
                onChange={(byMonthDay) => onChange({ ...draft, byMonthDay })}
                label="Day of the month"
              />
            </div>
          )}
          {draft.frequency === 'YEAR' && (
            <div className="time-component-row">
              <span className="time-component-row-label">on</span>
              <Select
                options={MONTH_OPTIONS}
                value={draft.byMonth}
                onChange={(byMonth) => onChange({ ...draft, byMonth })}
                label="Month"
              />
              <Select
                options={MONTH_DAY_OPTIONS}
                value={draft.byMonthDay}
                onChange={(byMonthDay) => onChange({ ...draft, byMonthDay })}
                label="Day of the month"
              />
            </div>
          )}
          {draft.slots.map((slot) => {
            const leaving = leavingSlots.includes(slot.key);
            const open =
              openPicker !== null &&
              'slotKey' in openPicker &&
              openPicker.slotKey === slot.key
                ? openPicker.kind === 'slot-times'
                  ? 'times'
                  : 'flex'
                : null;

            return (
              <AnimatedEntry
                key={slot.key}
                appear={spawnedSlots.has(slot.key)}
                leaving={leaving}
                onGone={() => dropSlot(slot.key)}
              >
                <SlotEditor
                  slot={slot}
                  removable={activeSlots > 1}
                  open={open}
                  onOpen={(kind) =>
                    toggle({
                      kind: kind === 'times' ? 'slot-times' : 'slot-flex',
                      slotKey: slot.key,
                    })
                  }
                  onChange={(change) =>
                    onChange(withSlotChanged(draft, slot.key, change))
                  }
                  onRemove={() => removeSlot(slot.key)}
                />
              </AnimatedEntry>
            );
          })}
          <IconButton
            className="time-component-add-slot"
            label="Add time slot"
            onClick={addSlot}
          >
            <IonIcon icon={addOutline} aria-hidden="true" />
          </IconButton>
        </>
      )}
    </div>
  );
};
