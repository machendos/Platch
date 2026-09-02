import './TimeComponentsBlock.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { addCircleOutline, chevronDownOutline } from 'ionicons/icons';
import { IconButton } from '../../../ui/buttons/IconButton';
import { Reveal } from '../../../ui/reveal/Reveal';
import type { TimeComponentWithSlots } from '../../../api/structures/TimeComponentWithSlots';
import { AnimatedEntry } from './AnimatedEntry';
import { TimeComponentEditor } from './TimeComponentEditor';
import { serializeTimeComponent } from './serializeTimeComponent';
import {
  buildReport,
  displayOrder,
  fromApiComponent,
  isDraftValid,
  newTimeComponentDraft,
  withType,
} from './timeComponentsState';
import type {
  TimeComponentDraft,
  TimeComponentsReport,
} from './timeComponentsState';

type TimeComponentsBlockProps = {
  initialTimeComponents: TimeComponentWithSlots[];
  /** Opens on one empty exact-time component when there are none to show.
      For a form creating something: nothing has been saved yet, so "No time
      components" would be a fact about the form rather than about the record.
      Left off, an empty list shows the empty state — which is still the right
      answer for an existing record that genuinely has none. */
  seedFirstComponent?: boolean;
  onChange: (report: TimeComponentsReport) => void;
};

const summaryText = (draft: TimeComponentDraft) => {
  const text = serializeTimeComponent(draft);
  if (isDraftValid(draft)) return text;
  return text ? `${text} (incomplete)` : 'Incomplete';
};

export const TimeComponentsBlock = ({
  initialTimeComponents,
  seedFirstComponent = false,
  onChange,
}: TimeComponentsBlockProps) => {
  const seeded = seedFirstComponent && initialTimeComponents.length === 0;

  const [baseline] = useState(initialTimeComponents);
  const [drafts, setDrafts] = useState<TimeComponentDraft[]>(() =>
    seeded
      ? [withType(newTimeComponentDraft(), 'ABSOLUTE')]
      : initialTimeComponents.map(fromApiComponent),
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
    onChangeRef.current(buildReport(drafts, baseline));
  }, [drafts, baseline]);

  const draftsByKey = useMemo(
    () => new Map(drafts.map((draft) => [draft.key, draft])),
    [drafts],
  );

  const isEditing = editOrder !== null;

  const startEditing = () =>
    setEditOrder(displayOrder(drafts).map((draft) => draft.key));

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
    const draft = newTimeComponentDraft();
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

  const replace = (key: string, next: TimeComponentDraft) =>
    setDrafts((current) =>
      current.map((draft) => (draft.key === key ? next : draft)),
    );

  const ordered = displayOrder(drafts);
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
                    isDraftValid(draft)
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
