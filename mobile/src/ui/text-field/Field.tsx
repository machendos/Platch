import { useId } from 'react';
import { FieldShell } from './FieldShell';
import { RichTextField } from './RichTextField';
import { TextField } from './TextField';

export type FieldProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  minRows?: number;
  allowNewlines?: boolean;
  onEnter?: () => void;
  formatting?: boolean;
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
  formatting = false,
  className,
}: FieldProps) => {
  const controlId = useId();

  return (
    <FieldShell
      controlId={controlId}
      label={label}
      labelable={!formatting}
      className={className}
    >
      {formatting ? (
        <RichTextField
          id={controlId}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          minRows={minRows}
        />
      ) : (
        <TextField
          id={controlId}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          minRows={minRows}
          allowNewlines={allowNewlines}
          onEnter={onEnter}
        />
      )}
    </FieldShell>
  );
};
