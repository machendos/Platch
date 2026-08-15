import './IconButton.css';

import type { ReactNode } from 'react';

type IconButtonProps = {
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
};

export const IconButton = ({
  label,
  onClick,
  children,
  className,
}: IconButtonProps) => (
  <button
    className={className ? `icon-button ${className}` : 'icon-button'}
    type="button"
    aria-label={label}
    onClick={onClick}
  >
    {children}
  </button>
);
