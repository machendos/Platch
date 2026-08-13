import type { ReactNode } from 'react';
import './DispatcherSection.css';

type DispatcherSectionProps = {
  title: string;
  expanded: boolean;
  onSetExpanded: (expanded: boolean) => void;
  children?: ReactNode;
};

export const DispatcherSection = ({
  title,
  expanded,
  onSetExpanded,
  children,
}: DispatcherSectionProps) => (
  <section className="dispatcher-section">
    <header className="section-header">
      <button
        className="chevron-button"
        onClick={() => onSetExpanded(!expanded)}
        aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
      >
        <span className={expanded ? 'chevron chevron-expanded' : 'chevron'}>
          ›
        </span>
      </button>
      <span className="section-title">{title}</span>
    </header>

    {expanded && <div className="section-body">{children}</div>}
  </section>
);
