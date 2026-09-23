import { useCallback, useEffect, useRef, useState } from 'react';
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
} from '../pickers';
import { useOutsideClose } from '../useOutsideClose';
import {
  WEEKDAYS,
  createSlotDraft,
  wrapsMidnight,
  changeFirstRecurringEventAt,
  changeRecurringFrequency,
  changeSlot,
  changeSlotToFlexible,
  removeSlot,
  changeSlotTime,
} from './recurringTimeComponentsState';
import { changeEventStart } from './eventState';
import { changeEntryKind } from './timeEntriesState';
import type {
  RecurringFrequency,
  SlotDraft,
  Weekday,
} from './recurringTimeComponentsState';
import type { EntryKind, TimeEntryDraft } from './timeEntriesState';

type TimeComponentEditorProps = {
  draft: TimeEntryDraft;
  ordinal?: number;
  onChange: (draft: TimeEntryDraft) => void;
  onDelete: () => void;
};

type OpenPicker =
  | {
      kind:
        | 'from-date'
        | 'from-time'
        | 'to-date'
        | 'to-time'
        | 'first-date'
        | 'last-date';
    }
  | { kind: 'slot-times' | 'slot-flex'; slotKey: string }
  | null;

const samePicker = (current: OpenPicker, wanted: Exclude<OpenPicker, null>) =>
  current !== null &&
  current.kind === wanted.kind &&
  ('slotKey' in wanted
    ? 'slotKey' in current && current.slotKey === wanted.slotKey
    : true);

const TYPE_OPTIONS: SegmentedOption<EntryKind>[] = [
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
          badge={wrapsMidnight(slot) ? '+1' : undefined}
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
        onFrom={(time) => onChange((slot) => changeSlotTime(slot, 'from', time))}
        onTo={(time) => onChange((slot) => changeSlotTime(slot, 'to', time))}
      />
      <InlineDurationPanel
        open={open === 'flex'}
        minutes={slot.flexibleMinutesNeeded}
        onChange={(minutes) => onChange((slot) => changeSlotToFlexible(slot, minutes))}
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

  const recurring = draft.kind === 'RECURRING' ? draft : null;

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
    if (!recurring) return;

    const slot = createSlotDraft();
    spawnedSlots.add(slot.key);
    onChange({
      ...recurring,
      recurringTimeSlots: [...recurring.recurringTimeSlots, slot],
    });
  };

  const startSlotRemoval = (slotKey: string) => {
    setLeavingSlots((keys) => [...keys, slotKey]);
    setOpenPicker((current) =>
      current !== null && 'slotKey' in current && current.slotKey === slotKey
        ? null
        : current,
    );
  };

  const dropSlot = (slotKey: string) => {
    setLeavingSlots((keys) => keys.filter((key) => key !== slotKey));

    const current = draftRef.current;
    if (current.kind === 'RECURRING')
      onChange(removeSlot(current, slotKey));
  };

  const activeSlots =
    (recurring?.recurringTimeSlots.length ?? 0) - leavingSlots.length;

  return (
    <div className="time-component-editor" ref={root}>
      <div className="time-component-editor-top">
        <span className="time-component-ordinal">
          {ordinal !== undefined ? `${ordinal}.` : ''}
        </span>
        <SegmentedControl
          options={TYPE_OPTIONS}
          value={draft.kind}
          onChange={(type) => {
            setOpenPicker(null);
            onChange(changeEntryKind(draft, type));
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

      {draft.kind === 'ABSOLUTE' ? (
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
              onChange(changeEventStart(draft, fromDate, draft.fromTime));
              closePicker();
            }}
          />
          <InlineTimePanel
            open={isOpen({ kind: 'from-time' })}
            value={draft.fromTime}
            onChange={(fromTime) =>
              onChange(changeEventStart(draft, draft.fromDate, fromTime))
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
              className="time-component-recurringInterval"
              options={INTERVAL_OPTIONS}
              value={draft.recurringInterval}
              onChange={(recurringInterval) =>
                onChange({ ...draft, recurringInterval })
              }
              label="Repeat recurringInterval"
            />
            <Select
              className="time-component-recurringFrequency"
              options={frequencyOptions(draft.recurringInterval > 1)}
              value={draft.recurringFrequency}
              onChange={(recurringFrequency) =>
                onChange(changeRecurringFrequency(draft, recurringFrequency))
              }
              label="Repeat unit"
            />
          </div>
          {draft.recurringFrequency === 'WEEK' && (
            <div className="time-component-row time-component-on-row">
              <span className="time-component-row-label">on</span>
              <ToggleGroup
                options={WEEKDAY_OPTIONS}
                values={draft.recurringByDay}
                onChange={(recurringByDay) =>
                  onChange({ ...draft, recurringByDay })
                }
                label="Days of the week"
                selectAllLabel="Select all"
                clearAllLabel="Clear all"
              />
            </div>
          )}
          {draft.recurringFrequency === 'MONTH' && (
            <div className="time-component-row">
              <span className="time-component-row-label">on</span>
              <Select
                options={MONTH_DAY_OPTIONS}
                value={draft.recurringByMonthDay}
                onChange={(recurringByMonthDay) =>
                  onChange({ ...draft, recurringByMonthDay })
                }
                label="Day of the month"
              />
            </div>
          )}
          {draft.recurringFrequency === 'YEAR' && (
            <div className="time-component-row">
              <span className="time-component-row-label">on</span>
              <Select
                options={MONTH_OPTIONS}
                value={draft.recurringByMonth}
                onChange={(recurringByMonth) =>
                  onChange({ ...draft, recurringByMonth })
                }
                label="Month"
              />
              <Select
                options={MONTH_DAY_OPTIONS}
                value={draft.recurringByMonthDay}
                onChange={(recurringByMonthDay) =>
                  onChange({ ...draft, recurringByMonthDay })
                }
                label="Day of the month"
              />
            </div>
          )}
          {draft.recurringTimeSlots.map((slot) => {
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
                    onChange(changeSlot(draft, slot.key, change))
                  }
                  onRemove={() => startSlotRemoval(slot.key)}
                />
              </AnimatedEntry>
            );
          })}
          <div className="time-slot-add-row">
            <span className="time-slot-bullet" aria-hidden="true" />
            <IconButton
              className="time-component-add-slot"
              label="Add time slot"
              onClick={addSlot}
            >
              <IonIcon icon={addOutline} aria-hidden="true" />
            </IconButton>
          </div>
          <div className="time-component-bounds-row">
            <span className="time-component-row-label">first</span>
            <PickerTrigger
              label="First occurrence date"
              text={
                draft.firstRecurringEventAt
                  ? serializeDate(draft.firstRecurringEventAt)
                  : null
              }
              placeholder="Date"
              open={isOpen({ kind: 'first-date' })}
              onPress={() => toggle({ kind: 'first-date' })}
            />
            <span className="time-component-row-label">last</span>
            <PickerTrigger
              label="Last occurrence date"
              text={
                draft.lastRecurringEventAt
                  ? serializeDate(draft.lastRecurringEventAt)
                  : null
              }
              placeholder="Never"
              open={isOpen({ kind: 'last-date' })}
              onPress={() => toggle({ kind: 'last-date' })}
            />
          </div>
          <InlineDatePanel
            open={isOpen({ kind: 'first-date' })}
            value={draft.firstRecurringEventAt}
            onChange={(firstRecurringEventAt) => {
              if (firstRecurringEventAt)
                onChange(changeFirstRecurringEventAt(draft, firstRecurringEventAt));
              closePicker();
            }}
          />
          <InlineDatePanel
            open={isOpen({ kind: 'last-date' })}
            value={draft.lastRecurringEventAt}
            min={draft.firstRecurringEventAt}
            clearable
            onChange={(lastRecurringEventAt) => {
              onChange({ ...draft, lastRecurringEventAt });
              closePicker();
            }}
          />
        </>
      )}
    </div>
  );
};
