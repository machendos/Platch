import './FieldShell.css';

import type { ReactNode } from 'react';

type FieldShellProps = {
  controlId: string;
  label?: string;
  // A contenteditable is not a labelable element, so `htmlFor` would point at
  // nothing. The formatted body carries `aria-labelledby` back to the label's
  // id instead, which is why the label always has one.
  labelable?: boolean;
  /** Drawn inside the field's box, left of the body. The Google Calendar
      idiom: a row that says what it is with a glyph instead of a word. */
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
};

export const FieldShell = ({
  controlId,
  label,
  labelable = true,
  icon,
  children,
  className,
}: FieldShellProps) => (
  <div
    className={['field', label ? null : 'field-unlabelled', className]
      .filter(Boolean)
      .join(' ')}
  >
    {label && (
      <label
        className="field-label"
        id={`${controlId}-label`}
        htmlFor={labelable ? controlId : undefined}
      >
        {label}
      </label>
    )}
    <div
      className={icon ? 'field-control field-control-iconed' : 'field-control'}
    >
      {icon && (
        <span className="field-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </div>
  </div>
);
