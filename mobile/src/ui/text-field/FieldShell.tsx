import './FieldShell.css';

import type { ReactNode } from 'react';

type FieldShellProps = {
  controlId: string;
  label?: string;
  // A contenteditable is not a labelable element, so `htmlFor` would point at
  // nothing. The formatted body carries `aria-labelledby` back to the label's
  // id instead, which is why the label always has one.
  labelable?: boolean;
  children: ReactNode;
  className?: string;
};

export const FieldShell = ({
  controlId,
  label,
  labelable = true,
  children,
  className,
}: FieldShellProps) => (
  <div className={className ? `field ${className}` : 'field'}>
    {label && (
      <label
        className="field-label"
        id={`${controlId}-label`}
        htmlFor={labelable ? controlId : undefined}
      >
        {label}
      </label>
    )}
    <div className="field-control">{children}</div>
  </div>
);
