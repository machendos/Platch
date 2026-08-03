import type { ReactNode } from 'react';
import './DispatcherSection.css';

type DispatcherSectionProps = {
  title: string;
  collapsed: boolean;
  onSetCollapsed: (collapsed: boolean) => void;
  children?: ReactNode;
};

export const DispatcherSection = ({
  title,
  collapsed,
  onSetCollapsed,
  children,
}: DispatcherSectionProps) => (
  <section className="dispatcher-section">
    <header className="section-header">
      <button
        className="chevron-button"
        onClick={() => onSetCollapsed(!collapsed)}
        aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
      >
        <span className={collapsed ? 'chevron' : 'chevron chevron-expanded'}>
          ›
        </span>
      </button>
      <span className="section-title">{title}</span>
    </header>

    {!collapsed && <div className="section-body">{children}</div>}
  </section>
);
