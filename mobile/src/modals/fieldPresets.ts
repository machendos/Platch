import type { FieldProps } from '../ui/text-field/Field';

export type FieldPreset = Pick<
  FieldProps,
  'label' | 'placeholder' | 'minRows' | 'allowNewlines'
>;

export const NAME_FIELD: FieldPreset = {
  label: 'Name',
  placeholder: 'Name it',
  minRows: 1,
  allowNewlines: false,
};

export const GOAL_FIELD: FieldPreset = {
  label: 'Goal',
  placeholder: 'What does done look like?',
  minRows: 1,
  allowNewlines: true,
};

export const CONTEXT_FIELD: FieldPreset = {
  label: 'Context',
  placeholder: 'Anything worth remembering',
  minRows: 3,
  allowNewlines: true,
};
