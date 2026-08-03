import { useRef, useState } from 'react';
import { Divider } from '../Divider';
import { DispatcherSection } from './DispatcherSection';
import { useSectionResize } from './useSectionResize';
import type { SectionHeightWeights } from './useSectionResize';
import './Dispatcher.css';

type SectionName = 'plan' | 'active' | 'backlog';

const INITIAL_COLLAPSED = { plan: false, active: true, backlog: true };
const EVEN_WEIGHTS: SectionHeightWeights = { plan: 1, active: 1, backlog: 1 };

// Temporary content to test scrolling inside a section.
const testItems = Array.from({ length: 20 }, (_, i) => (
  <div key={i} className="test-item">
    Test item {i + 1}
  </div>
));

export const Dispatcher = () => {
  const [collapsed, setCollapsed] = useState(INITIAL_COLLAPSED);
  const [weights, setWeights] = useState<SectionHeightWeights>(EVEN_WEIGHTS);

  const containerRef = useRef<HTMLDivElement>(null);
  const { beginDrag, resizePlan, resizeActive } = useSectionResize(
    containerRef,
    setWeights,
  );

  const setSectionCollapsed = (section: SectionName, isCollapsed: boolean) => {
    setCollapsed({ ...collapsed, [section]: isCollapsed });
    setWeights(EVEN_WEIGHTS);
  };

  const showPlanDivider = !collapsed.plan && !collapsed.active;
  const showActiveDivider = !collapsed.active && !collapsed.backlog;

  // PLAN, [divider], ACTIVE PROJECTS, [divider], BACKLOG.
  const sectionTrack = (isCollapsed: boolean, weight: number) =>
    isCollapsed ? 'auto' : `minmax(var(--section-header-height), ${weight}fr)`;
  const gridTemplateRows = [
    sectionTrack(collapsed.plan, weights.plan),
    ...(showPlanDivider ? ['auto'] : []),
    sectionTrack(collapsed.active, weights.active),
    ...(showActiveDivider ? ['auto'] : []),
    sectionTrack(collapsed.backlog, weights.backlog),
  ].join(' ');

  return (
    <div className="dispatcher" ref={containerRef} style={{ gridTemplateRows }}>
      <DispatcherSection
        title="PLAN"
        collapsed={collapsed.plan}
        onSetCollapsed={(next) => setSectionCollapsed('plan', next)}
      >
        {testItems}
      </DispatcherSection>

      {showPlanDivider && (
        <Divider
          orientation="horizontal"
          onDragStart={beginDrag}
          onDrag={resizePlan}
        />
      )}

      <DispatcherSection
        title="ACTIVE PROJECTS"
        collapsed={collapsed.active}
        onSetCollapsed={(next) => setSectionCollapsed('active', next)}
      >
        <p>Active projects content</p>
      </DispatcherSection>

      {showActiveDivider && (
        <Divider
          orientation="horizontal"
          onDragStart={beginDrag}
          onDrag={resizeActive}
        />
      )}

      <DispatcherSection
        title="BACKLOG"
        collapsed={collapsed.backlog}
        onSetCollapsed={(next) => setSectionCollapsed('backlog', next)}
      >
        <p>Backlog content</p>
      </DispatcherSection>
    </div>
  );
};
