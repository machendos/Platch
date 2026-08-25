import './DateInput.css';

import { useId, useState } from 'react';
// Imported here as well as in Header, because this control can be the only
// mobiscroll on screen — a modal is not rendered under the main page.
import '@mobiscroll/react/dist/css/mobiscroll.min.css';
import { Datepicker } from '@mobiscroll/react';
import type { MbscDatepickerChangeEvent } from '@mobiscroll/react/dist/src/core/components/datepicker/datepicker.types.public';
import type { Temporal } from 'temporal-polyfill';
import { WEEK_STARTS_ON } from '../../config/calendarPreferences';
import { serializeDate } from '../../system/helpers/dateTimeSerializers';
import { fromJsDate, toJsDate } from '../../system/helpers/helpers';
import { FieldShell } from '../text-field/FieldShell';
import { DateInputTrigger } from './DateInputTrigger';

type DateInputProps = {
  value: Temporal.PlainDate | null;
  onChange: (value: Temporal.PlainDate) => void;
  /** Names the field for assistive technology; nothing is drawn for it, the
      same as `Select`, because these sit on rows that carry their own text. */
  label: string;
  placeholder?: string;
  isDarkModeEnabled?: boolean;
  className?: string;
};

export const DateInput = ({
  value,
  onChange,
  label,
  placeholder = 'Not set',
  isDarkModeEnabled = false,
  className,
}: DateInputProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const controlId = `date-input-${useId().replace(/[^\w-]/g, '')}`;

  // Dismissing the calendar without picking reports the value it opened on, so
  // there is no half-made state to hold the way the header's range picker has.
  const handleChange = ({ value: picked }: MbscDatepickerChangeEvent) => {
    if (!(picked instanceof Date)) return;

    onChange(fromJsDate(picked));
  };

  const classes = ['date-input', isOpen ? 'date-input-is-open' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    // The hairline, its focus colour and the fill are FieldShell's, the same
    // shell Field and Select render through. Restating them here would be
    // another copy of one decision.
    <FieldShell controlId={controlId} className={classes}>
      <Datepicker
        select="date"
        controls={['calendar']}
        display="anchored"
        touchUi="auto"
        firstDay={WEEK_STARTS_ON}
        // Pinned rather than left on `auto`, which picks by platform and would
        // render this picker `mbsc-material` where the calendar — pinned in
        // Calendar.tsx — still renders `mbsc-ios`. Same reasoning as Header.
        theme="ios"
        themeVariant={isDarkModeEnabled ? 'dark' : 'light'}
        value={value ? toJsDate(value) : null}
        onChange={handleChange}
        // Carried as a class rather than left to the shell's `:focus-within`:
        // the calendar takes the focus while it is open, so a focus-driven fill
        // would drop off the field the moment the panel it belongs to appears.
        onOpen={() => setIsOpen(true)}
        onClose={() => setIsOpen(false)}
        inputComponent={DateInputTrigger}
        inputProps={{
          id: controlId,
          label,
          text: value ? serializeDate(value) : '',
          placeholder,
        }}
      />
    </FieldShell>
  );
};
