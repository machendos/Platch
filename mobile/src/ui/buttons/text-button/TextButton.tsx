import './TextButton.css';

import type { ReactNode } from 'react';
import type { ControlSize } from '../icon-button/IconButton';
import { usePress } from '../pressable/usePress';

type TextButtonProps = {
  size: ControlSize;
  /** The outlined stadium — a control that is a standing exit rather than one
      action among several. Today is the only one so far. */
  outlined?: boolean;
  onClick: () => void;
  /** Sits after the label, and says the label opens something. */
  trailing?: ReactNode;
  animate?: boolean;
  label?: string;
  /** For a caller that measures the label itself — the date frame fits its
      text to a fixed box. */
  labelRef?: React.Ref<HTMLSpanElement>;
  labelStyle?: React.CSSProperties;
  style?: React.CSSProperties;
  className?: string;
  ref?: React.Ref<HTMLButtonElement>;
  children: ReactNode;
};

export const TextButton = ({
  size,
  outlined = false,
  onClick,
  trailing,
  animate = true,
  label,
  labelRef,
  labelStyle,
  style,
  className,
  ref,
  children,
}: TextButtonProps) => {
  const press = usePress<HTMLButtonElement>({ ref, animate });

  return (
    <button
      ref={press.ref}
      className={[
        press.className,
        'text-button',
        size === 'large' ? 'text-button-lg' : 'text-button-md',
        outlined ? 'text-button-outlined' : null,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      type="button"
      aria-label={label}
      onClick={onClick}
      onPointerDown={press.onPointerDown}
      onPointerUp={press.onPointerUp}
      onPointerCancel={press.onPointerCancel}
      onPointerLeave={press.onPointerLeave}
    >
      <span className="text-button-label" ref={labelRef} style={labelStyle}>
        {children}
      </span>
      {trailing && (
        <span className="text-button-trailing" aria-hidden="true">
          {trailing}
        </span>
      )}
    </button>
  );
};
