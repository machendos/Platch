import type { ReactNode } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { IconButton } from '../../../ui/buttons/icon-button/IconButton';
import { Pressable } from '../../../ui/buttons/press/Pressable';
import './DispatcherSection.css';

type DispatcherSectionProps = {
  title: string;
  expanded: boolean;
  onSetExpanded: (expanded: boolean) => void;
  /** Omitted where a section has nothing to count, which is what keeps PLAN
      from claiming a number it cannot have. */
  count?: number;
  onAdd?: () => void;
  children?: ReactNode;
};

export const DispatcherSection = ({
  title,
  expanded,
  onSetExpanded,
  count,
  onAdd,
  children,
}: DispatcherSectionProps) => {
  /* No scale: this target is the width of the pane, and shrinking it reads as
     the whole section twitching rather than a button answering. The fill in
     the stylesheet is the visible half. */

  return (
    <section className="dispatcher-section">
      <header className="section-header">
        <Pressable
          shape="none"
          className="section-hit"
          aria-expanded={expanded}
          onClick={() => onSetExpanded(!expanded)}
        >
          <ChevronRight className="section-chevron" aria-hidden="true" />
          <span className="section-title">{title}</span>
          {count !== undefined && (
            <span className="section-count">{count}</span>
          )}
        </Pressable>

        {onAdd && (
          <IconButton
            className="section-add"
            label={`Add to ${title}`}
            onClick={onAdd}
            size="large"
          >
            <Plus aria-hidden="true" />
          </IconButton>
        )}
      </header>

      {expanded && <div className="section-body">{children}</div>}
    </section>
  );
};
