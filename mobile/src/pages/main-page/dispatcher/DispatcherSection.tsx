import type { ReactNode } from 'react';
import { IonIcon } from '@ionic/react';
import { addCircleOutline } from 'ionicons/icons';
import { IconButton } from '../../../ui/buttons/IconButton';
import './DispatcherSection.css';

type DispatcherSectionProps = {
  title: string;
  expanded: boolean;
  onSetExpanded: (expanded: boolean) => void;
  onAdd?: () => void;
  children?: ReactNode;
};

export const DispatcherSection = ({
  title,
  expanded,
  onSetExpanded,
  onAdd,
  children,
}: DispatcherSectionProps) => (
  <section className="dispatcher-section">
    <header className="section-header">
      <IconButton
        className="chevron-button"
        label={expanded ? `Collapse ${title}` : `Expand ${title}`}
        onClick={() => onSetExpanded(!expanded)}
      >
        <span className={expanded ? 'chevron chevron-expanded' : 'chevron'}>
          ›
        </span>
      </IconButton>

      <span className="section-title">{title}</span>

      {/* The slot is rendered whether or not it holds a button: it is what
          balances the chevron, and the title is centred between the two. */}
      <span className="section-header-slot">
        {onAdd && (
          <IconButton label={`Add to ${title}`} onClick={onAdd}>
            <IonIcon icon={addCircleOutline} aria-hidden="true" />
          </IconButton>
        )}
      </span>
    </header>

    {expanded && <div className="section-body">{children}</div>}
  </section>
);
