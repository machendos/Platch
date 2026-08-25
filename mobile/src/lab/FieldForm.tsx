import './FieldForm.css';

import { Field } from '../ui/text-field/Field';
import { RichTextToolbar } from '../ui/text-field/RichTextToolbar';
import { ActiveFieldProvider } from '../ui/text-field/richText/activeField';
import { CONTEXT_FIELD, GOAL_FIELD, NAME_FIELD } from '../modals/fieldPresets';
import { useFormState } from '../modals/useFormState';

export const OPENED_WITH = {
  name: 'Rebuild the shed',
  goal: 'Roof on before the rain.\nDoor that shuts.',
  context: '- [x] Order the timber\n- [ ] Order the felt\n- [ ] Book the skip',
};

/* The three fields as a form rather than as specimens, so dirty tracking has
   something real to be dirty about — including the checklist, which is the
   edit that feels committed and is not. */
export const FieldForm = ({
  values,
  set,
}: Pick<
  ReturnType<typeof useFormState<typeof OPENED_WITH>>,
  'values' | 'set'
>) => (
  <ActiveFieldProvider>
    <RichTextToolbar />

    <div className="field-form">
      <Field
        {...NAME_FIELD}
        value={values.name}
        onChange={(value) => set('name', value)}
      />
      <Field
        {...GOAL_FIELD}
        value={values.goal}
        onChange={(value) => set('goal', value)}
      />
      <Field
        {...CONTEXT_FIELD}
        value={values.context}
        onChange={(value) => set('context', value)}
      />
    </div>
  </ActiveFieldProvider>
);
