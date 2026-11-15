import './IconButton.css';
import '../press/press.css';

import type { ReactNode } from 'react';
import { usePress } from '../press/usePress';

export type ControlSize = 'medium' | 'large';

type IconButtonProps = {
  label: string;
  /** Required on purpose: there is no default rung, so adding a third later
      makes the compiler list every call site that has to reconsider. */
  size: ControlSize;
  onClick: () => void;
  /** Set only for a toggle. Undefined means the button is a command and gets
      no pressed state at all, which is not the same as `false`. */
  pressed?: boolean;
  /** aria-disabled, not `disabled`: a control that is unavailable for a stated
      reason has to stay focusable and clickable so it can give the reason. */
  unavailable?: boolean;
  children: ReactNode;
  className?: string;
};

export const IconButton = ({
  label,
  size,
  onClick,
  pressed,
  unavailable = false,
  children,
  className,
}: IconButtonProps) => {
  const press = usePress({ enabled: !unavailable });

  return (
    <button
    className={[
      'icon-button',
      size === 'large' ? 'icon-button-lg' : 'icon-button-md',
      className,
    ]
      .filter(Boolean)
      .join(' ')}
    type="button"
    aria-label={label}
    aria-pressed={pressed}
    aria-disabled={unavailable || undefined}
    onPointerDown={press.hold}
    data-pressed={press.pressed ? '' : undefined}
    onClick={onClick}
    >
      <span className="icon-button-face">
        <span className="press-shade" />
        {children}
      </span>
    </button>
  );
};
