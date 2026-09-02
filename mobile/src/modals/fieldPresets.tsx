import type { ReactNode } from 'react';
import { IonIcon } from '@ionic/react';
import { flagOutline, reorderThreeOutline } from 'ionicons/icons';
import type { FieldProps } from '../ui/text-field/Field';

export type FieldPreset = Pick<
  FieldProps,
  'label' | 'icon' | 'placeholder' | 'minRows' | 'allowNewlines' | 'formatting'
>;

const icon = (glyph: string): ReactNode => (
  <IonIcon icon={glyph} aria-hidden="true" />
);

/* No label, because the name is the record's title rather than one of its
   fields — Google Calendar's event name, not a form row. Enter does not open a
   second line (it blurs, dismissing the keyboard); a name long enough to wrap
   still grows the field, which is the rule every field here follows. */
export const NAME_FIELD: FieldPreset = {
  placeholder: 'Add name',
  minRows: 1,
  allowNewlines: false,
};

/* Goal and context lead with a glyph instead of a label, the way an event's
   rows do: one line each until they have something to hold, and a column of
   icons down the left saying what each row is without spending a line on it.
   Switching either back to a labelled row is `label:` in place of `icon:`. */
export const GOAL_FIELD: FieldPreset = {
  icon: icon(flagOutline),
  placeholder: 'Goal. What does done look like?',
  minRows: 1,
  allowNewlines: true,
};

export const CONTEXT_FIELD: FieldPreset = {
  icon: icon(reorderThreeOutline),
  placeholder: 'Context. Anything worth remembering',
  minRows: 1,
  allowNewlines: true,
  formatting: true,
};
