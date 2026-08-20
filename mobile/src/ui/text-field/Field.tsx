import { useId } from 'react';
import { FieldShell } from './FieldShell';
import { TextField } from './TextField';

export type FieldProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  minRows?: number;
  allowNewlines?: boolean;
  onEnter?: () => void;
  className?: string;
};

export const Field = ({
  value,
  onChange,
  label,
  placeholder,
  minRows = 1,
  allowNewlines = true,
  onEnter,
  className,
}: FieldProps) => {
  const controlId = useId();

  return (
    <FieldShell controlId={controlId} label={label} className={className}>
      <TextField
        id={controlId}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        minRows={minRows}
        allowNewlines={allowNewlines}
        onEnter={onEnter}
      />
    </FieldShell>
  );
};
