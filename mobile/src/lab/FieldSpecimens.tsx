import './FieldSpecimens.css';

import { useState } from 'react';
import { Field } from '../ui/text-field/Field';
import { RichTextToolbar } from '../ui/text-field/RichTextToolbar';
import { ActiveFieldProvider } from '../ui/text-field/richText/activeField';
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
    id: 'context-tall',
    note: 'context / taller than the screen, toolbar must stay reachable',
    preset: CONTEXT_FIELD,
    initial:
      '1. Step 1 of a list long enough to scroll its own toolbar off the top\n2. Step 2 of a list long enough to scroll its own toolbar off the top\n3. Step 3 of a list long enough to scroll its own toolbar off the top\n4. Step 4 of a list long enough to scroll its own toolbar off the top\n5. Step 5 of a list long enough to scroll its own toolbar off the top\n6. Step 6 of a list long enough to scroll its own toolbar off the top\n7. Step 7 of a list long enough to scroll its own toolbar off the top\n8. Step 8 of a list long enough to scroll its own toolbar off the top\n9. Step 9 of a list long enough to scroll its own toolbar off the top\n10. Step 10 of a list long enough to scroll its own toolbar off the top\n11. Step 11 of a list long enough to scroll its own toolbar off the top\n12. Step 12 of a list long enough to scroll its own toolbar off the top\n13. Step 13 of a list long enough to scroll its own toolbar off the top\n14. Step 14 of a list long enough to scroll its own toolbar off the top\n15. Step 15 of a list long enough to scroll its own toolbar off the top\n16. Step 16 of a list long enough to scroll its own toolbar off the top\n17. Step 17 of a list long enough to scroll its own toolbar off the top\n18. Step 18 of a list long enough to scroll its own toolbar off the top\n19. Step 19 of a list long enough to scroll its own toolbar off the top\n20. Step 20 of a list long enough to scroll its own toolbar off the top\n21. Step 21 of a list long enough to scroll its own toolbar off the top\n22. Step 22 of a list long enough to scroll its own toolbar off the top\n23. Step 23 of a list long enough to scroll its own toolbar off the top\n24. Step 24 of a list long enough to scroll its own toolbar off the top\n25. Step 25 of a list long enough to scroll its own toolbar off the top',
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
    <ActiveFieldProvider>
      <RichTextToolbar />
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
    </ActiveFieldProvider>
  );
};
