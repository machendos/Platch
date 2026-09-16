import './IconButton.css';

import type { ReactNode } from 'react';
import { usePress } from '../pressable/usePress';

export type ControlSize = 'medium' | 'large';

type IconButtonProps = {
  label: string;
  /** Required on purpose: there is no default rung, so adding a third later
      makes the compiler list every call site that has to reconsider. */
  size: ControlSize;
  onClick: () => void;
  children: ReactNode;
  className?: string;
};

export const IconButton = ({
  label,
  size,
  onClick,
  children,
  className,
}: IconButtonProps) => {
  const press = usePress();

  return (
    <button
      ref={press.ref}
      className={[
        press.className,
        'icon-button',
        size === 'large' ? 'icon-button-lg' : 'icon-button-md',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      type="button"
      aria-label={label}
      onClick={onClick}
      onPointerDown={press.onPointerDown}
      onPointerUp={press.onPointerUp}
      onPointerCancel={press.onPointerCancel}
      onPointerLeave={press.onPointerLeave}
    >
      <span className="icon-button-face">{children}</span>
    </button>
  );
};
