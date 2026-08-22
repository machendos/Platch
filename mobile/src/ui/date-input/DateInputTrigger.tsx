import type { Ref } from 'react';
import { IonIcon } from '@ionic/react';
import { calendarOutline } from 'ionicons/icons';

type DateInputTriggerProps = {
  id: string;
  label: string;
  /** Already serialized, or empty when there is no date yet. */
  text: string;
  placeholder: string;
  ref?: Ref<HTMLButtonElement>;
};

// A button rather than an input, and the text is ours rather than mobiscroll's.
// A custom inputComponent is handed only `{defaultValue, placeholder, ref}` —
// the value is *uncontrolled*, written into the element through that ref — so
// an input here would hold whatever mobiscroll formatted, and the app's own
// date serialization would never be what the field shows.
export const DateInputTrigger = ({
  id,
  label,
  text,
  placeholder,
  ref,
}: DateInputTriggerProps) => (
  <button
    id={id}
    ref={ref}
    className="date-input-field"
    type="button"
    aria-label={label}
    aria-haspopup="dialog"
  >
    <span className={text ? undefined : 'date-input-placeholder'}>
      {text || placeholder}
    </span>
    <IonIcon
      className="date-input-icon"
      icon={calendarOutline}
      aria-hidden="true"
    />
  </button>
);
