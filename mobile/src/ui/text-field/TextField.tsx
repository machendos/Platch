import './TextField.css';

import type { CSSProperties, KeyboardEvent } from 'react';

type TextFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minRows: number;
  allowNewlines: boolean;
  onEnter?: () => void;
};

export const TextField = ({
  id,
  value,
  onChange,
  placeholder,
  minRows,
  allowNewlines,
  onEnter,
}: TextFieldProps) => {
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (allowNewlines || event.key !== 'Enter') return;

    // Enter also confirms an IME candidate; swallowing it there would eat the
    // composition instead of ending the edit.
    if (event.nativeEvent.isComposing) return;

    event.preventDefault();

    if (onEnter) {
      onEnter();
      return;
    }

    event.currentTarget.blur();
  };

  return (
    <div
      className="field-body"
      data-replicated-value={value}
      style={{ '--field-min-rows': minRows } as CSSProperties}
    >
      <textarea
        id={id}
        className="field-textarea field-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        enterKeyHint={allowNewlines ? undefined : 'done'}
        rows={1}
      />
    </div>
  );
};
