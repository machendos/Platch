import './Checkbox.css';

import type { ReactNode } from 'react';
import { IonIcon } from '@ionic/react';
import { checkmark } from 'ionicons/icons';

export type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
  className?: string;
};

export const Checkbox = ({
  checked,
  onChange,
  label,
  disabled = false,
  className,
}: CheckboxProps) => {
  const classes = ['checkbox'];
  if (disabled) classes.push('checkbox-disabled');
  if (className) classes.push(className);

  return (
    <label className={classes.join(' ')}>
      <input
        className="checkbox-input"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="checkbox-box" aria-hidden="true">
        <IonIcon className="checkbox-tick" icon={checkmark} />
      </span>
      <span className="checkbox-label">{label}</span>
    </label>
  );
};
