import './FieldSpecimens.css';

import { useState } from 'react';
import { Field } from '../ui/text-field/Field';
import {
  CONTEXT_FIELD,
  GOAL_FIELD,
  NAME_FIELD,
  type FieldPreset,
} from '../modals/fieldPresets';

type Specimen = {
  id: string;
  note: string;
  preset: FieldPreset;
  initial: string;
};

const LONG_NAME =
  'A name nobody should ever type but which has to survive being typed anyway, ' +
  'running on far past the point where any reasonable person would have stopped, ' +
  'so that the field has to prove it wraps line after line after line instead of ' +
  'clipping the tail or scrolling it sideways out of view where it cannot be read';

const UNBREAKABLE =
  'asdasdasdasdasdasdasdasdasdadasdasdasdaadadadadasdsadasdasdasdasdasdasdasdasdasdasdasd' +
  'https://example.com/a/path/nobody/would/ever/shorten?with=a&query=string&that=keeps&on=going';

const SPECIMENS: Specimen[] = [
  { id: 'name-empty', note: 'name / empty', preset: NAME_FIELD, initial: '' },
  {
    id: 'name-filled',
    note: 'name / filled',
    preset: NAME_FIELD,
    initial: 'Rebuild the shed',
  },
  {
    id: 'name-long',
    note: 'name / absurd, must wrap not clip',
    preset: NAME_FIELD,
    initial: LONG_NAME,
  },
  {
    id: 'name-unbreakable',
    note: 'name / one word longer than the line, must break not widen',
    preset: NAME_FIELD,
    initial: `Rebuild the shed ${UNBREAKABLE} and then some`,
  },
  { id: 'goal-empty', note: 'goal / empty', preset: GOAL_FIELD, initial: '' },
  {
    id: 'goal-filled',
    note: 'goal / several lines',
    preset: GOAL_FIELD,
    initial:
      'Roof on before the rain.\nDoor that shuts.\nSomewhere to put the bikes.',
  },
  {
    id: 'context-empty',
    note: 'context / empty, opens at 3 rows',
    preset: CONTEXT_FIELD,
    initial: '',
  },
  {
    id: 'context-trailing-newline',
    note: 'context / ends in a newline, must not collapse',
    preset: CONTEXT_FIELD,
    initial: 'Timber is ordered.\nFelt is not.\n',
  },
  {
    id: 'context-ordered',
    note: 'context / ordered list, nested one level',
    preset: CONTEXT_FIELD,
    initial:
      '1. Strip the felt\n    1. Lift the battens\n    2. Bag the nails\n2. Re-deck\n3. New felt',
  },
  {
    id: 'context-checklist',
    note: 'context / checklist, checked and unchecked',
    preset: CONTEXT_FIELD,
    initial:
      '- [x] Order the timber\n- [ ] Order the felt\n- [ ] Book the skip',
  },
  {
    id: 'context-emphasis',
    note: 'context / bold and italic',
    preset: CONTEXT_FIELD,
    initial:
      'The **roof** goes on first. Everything else is *weather-dependent*.',
  },
];

export const FieldSpecimens = () => {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(SPECIMENS.map(({ id, initial }) => [id, initial])),
  );

  return (
    <div className="field-specimens">
      {SPECIMENS.map(({ id, note, preset }) => (
        <section className="field-specimen" key={id}>
          <p className="field-specimen-note">{note}</p>
          <Field
            {...preset}
            className={`specimen-${id}`}
            value={values[id]}
            onChange={(value) =>
              setValues((current) => ({ ...current, [id]: value }))
            }
          />
          <p className="field-specimen-probe" data-probe={id}>
            probe
          </p>
          <pre className="field-specimen-value" data-value={id}>
            {JSON.stringify(values[id])}
          </pre>
        </section>
      ))}
    </div>
  );
};
