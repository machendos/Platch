import './TimeComponentsBlock.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { addCircleOutline, chevronDownOutline } from 'ionicons/icons';
import { IconButton } from '../../../ui/buttons/IconButton';
import { Reveal } from '../../../ui/reveal/Reveal';
import type { RecurringTimeComponent } from '../../../api/project';
import { AnimatedEntry } from './AnimatedEntry';
import { TimeComponentEditor } from './TimeComponentEditor';
import { serializeTimeEntry } from './serializeTimeEntry';
import {
  toRecurringTimeComponentDraft,
  createRecurringTimeComponentDraft,
} from './recurringTimeComponentsState';
import { toEventDraft, createEventDraft } from './eventState';
import type { Event } from '../../../api/event';
import { buildTimeEntriesReport, sortEntriesForDisplay, isEntryValid } from './timeEntriesState';
import type { TimeEntriesReport, TimeEntryDraft } from './timeEntriesState';

type TimeComponentsBlockProps = {
  initialRecurringTimeComponents: RecurringTimeComponent[];
  initialEvents: Event[];
  /** Opens on one empty exact-time component when there are none to show.
      For a form creating something: nothing has been saved yet, so "No time
      components" would be a fact about the form rather than about the record.
      Left off, an empty list shows the empty state — which is still the right
      answer for an existing record that genuinely has none. */
  seedFirstComponent?: boolean;
  onChange: (report: TimeEntriesReport) => void;
};

const summaryText = (draft: TimeEntryDraft) => {
  const text = serializeTimeEntry(draft);
  if (isEntryValid(draft)) return text;
  return text ? `${text} (incomplete)` : 'Incomplete';
};

export const TimeComponentsBlock = ({
  initialRecurringTimeComponents,
  initialEvents,
  seedFirstComponent = false,
  onChange,
}: TimeComponentsBlockProps) => {
  const seeded =
    seedFirstComponent &&
    initialRecurringTimeComponents.length === 0 &&
    initialEvents.length === 0;

  const [baseline] = useState(initialRecurringTimeComponents);
  const [eventBaseline] = useState(initialEvents);
  const [drafts, setDrafts] = useState<TimeEntryDraft[]>(() =>
    seeded
      ? [createEventDraft()]
      : [
          ...initialRecurringTimeComponents.map(toRecurringTimeComponentDraft),
          ...initialEvents.map(toEventDraft),
        ],
  );
  // The order components are shown in while editing, frozen when the session
  // starts: switching a component's type must not teleport it mid-edit. Peace
  // mode re-sorts every time.
  //
  // A seeded component opens straight into the editor: it exists to be filled
  // in, and peace mode would file it behind an Edit link as "Incomplete".
  const [editOrder, setEditOrder] = useState<string[] | null>(() =>
    seeded ? drafts.map((draft) => draft.key) : null,
  );
  const [leavingKeys, setLeavingKeys] = useState<string[]>([]);
  const spawnedKeys = useRef(new Set<string>()).current;

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    onChangeRef.current(buildTimeEntriesReport(drafts, baseline, eventBaseline));
  }, [drafts, baseline, eventBaseline]);

  const draftsByKey = useMemo(
    () => new Map(drafts.map((draft) => [draft.key, draft])),
    [drafts],
  );

  const isEditing = editOrder !== null;

  const startEditing = () =>
    setEditOrder(sortEntriesForDisplay(drafts).map((draft) => draft.key));

  // The modes are deliberately asymmetric: the editors animate open and
  // closed, the summary never animates. It appears the moment the collapse
  // starts, so the cards read as shrinking into the lines above them.
  const stopEditing = () => {
    setDrafts((current) =>
      current.filter((draft) => !leavingKeys.includes(draft.key)),
    );
    setLeavingKeys([]);
    setEditOrder(null);
    spawnedKeys.clear();
  };

  const addComponent = () => {
    const draft = createRecurringTimeComponentDraft();
    spawnedKeys.add(draft.key);
    setDrafts((current) => [...current, draft]);
    setEditOrder((order) => (order ? [...order, draft.key] : order));
  };

  const removeComponent = (key: string) =>
    setLeavingKeys((keys) => [...keys, key]);

  const dropComponent = (key: string) => {
    setDrafts((current) => current.filter((draft) => draft.key !== key));
    setLeavingKeys((keys) => keys.filter((other) => other !== key));
    setEditOrder((order) =>
      order ? order.filter((other) => other !== key) : order,
    );
  };

  const replace = (key: string, next: TimeEntryDraft) =>
    setDrafts((current) =>
      current.map((draft) => (draft.key === key ? next : draft)),
    );

  const ordered = sortEntriesForDisplay(drafts);
  const activeCount = (editOrder ?? []).filter(
    (key) => !leavingKeys.includes(key),
  ).length;

  return (
    <section className="time-components-block">
      <div
        className="time-components-head"
        onClick={(event) => {
          if ((event.target as Element).closest('.icon-button')) return;
          if (isEditing) stopEditing();
          else startEditing();
        }}
      >
        {isEditing && (
          <IconButton
            label="Done editing time components"
            onClick={stopEditing}
          >
            <IonIcon icon={chevronDownOutline} aria-hidden="true" />
          </IconButton>
        )}
      </div>

      {!isEditing && (
        <div className="time-components-peace" onClick={startEditing}>
          <button
            className="time-components-edit"
            type="button"
            onClick={startEditing}
          >
            Edit
          </button>
          {ordered.length > 0 ? (
            <ol className="time-components-list time-components-summaries">
              {ordered.map((draft, index) => (
                <li
                  key={draft.key}
                  className={
                    isEntryValid(draft)
                      ? undefined
                      : 'time-component-incomplete'
                  }
                >
                  <span className="time-component-ordinal">{index + 1}.</span>
                  {summaryText(draft)}
                </li>
              ))}
            </ol>
          ) : (
            <p className="time-components-empty">No time components</p>
          )}
        </div>
      )}

      <Reveal when={isEditing} intoView>
        <ol className="time-components-list time-components-editors">
          {(() => {
            const ordinals = new Map<string, number>();
            let next = 0;
            for (const key of editOrder ?? []) {
              if (!leavingKeys.includes(key)) ordinals.set(key, (next += 1));
            }

            return (editOrder ?? []).map((key) => {
              const draft = draftsByKey.get(key);
              if (!draft) return null;
              const leaving = leavingKeys.includes(key);

              return (
                <li key={key}>
                  <AnimatedEntry
                    appear={spawnedKeys.has(key)}
                    leaving={leaving}
                    onGone={() => dropComponent(key)}
                  >
                    <div className="time-component-entry">
                      <TimeComponentEditor
                        draft={draft}
                        ordinal={ordinals.get(key)}
                        onChange={(next) => replace(key, next)}
                        onDelete={() => removeComponent(key)}
                      />
                    </div>
                  </AnimatedEntry>
                </li>
              );
            });
          })()}
          <li>
            <button
              className="time-component-add-card"
              type="button"
              aria-label="Add time component"
              onClick={addComponent}
            >
              <span className="time-component-ordinal">{activeCount + 1}.</span>
              <IonIcon icon={addCircleOutline} aria-hidden="true" />
            </button>
          </li>
        </ol>
      </Reveal>
    </section>
  );
};
