import './TextButton.css';

import type { ReactNode } from 'react';
import type { ControlSize } from '../icon-button/IconButton';
import { Pressable } from '../press/Pressable';

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
  return (
    <Pressable
      shape="text"
      pressable={animate}
      ref={ref}
      className={[
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
    >
      <span className="text-button-label" ref={labelRef} style={labelStyle}>
        {children}
      </span>
      {trailing && (
        <span className="text-button-trailing" aria-hidden="true">
          {trailing}
        </span>
      )}
    </Pressable>
  );
};
