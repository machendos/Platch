import { useId } from 'react';
import type { ReactNode } from 'react';
import { FieldShell } from './FieldShell';
import { TextField } from './TextField';
import { RichTextField } from './richText/RichTextField';

export type FieldProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  /** Stands in for the label on a form whose rows are icon-led. */
  icon?: ReactNode;
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
  icon,
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
      icon={icon}
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
