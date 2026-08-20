import './FieldShell.css';

import type { ReactNode } from 'react';

type FieldShellProps = {
  controlId: string;
  label?: string;
  children: ReactNode;
  className?: string;
};

export const FieldShell = ({
  controlId,
  label,
  children,
  className,
}: FieldShellProps) => (
  <div className={className ? `field ${className}` : 'field'}>
    {label && (
      <label
        className="field-label"
        id={`${controlId}-label`}
        htmlFor={controlId}
      >
        {label}
      </label>
    )}
    <div className="field-control">{children}</div>
  </div>
);
