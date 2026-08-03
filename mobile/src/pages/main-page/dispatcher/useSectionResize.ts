import { useRef } from 'react';
import type { RefObject } from 'react';
import { DISPATCHER_SECTION_HEADER_HEIGHT } from '../layout-constants';

export type SectionHeightWeights = {
  plan: number;
  active: number;
  backlog: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const useSectionResize = (
  containerRef: RefObject<HTMLDivElement | null>,
  setWeights: (weights: SectionHeightWeights) => void,
) => {
  const startHeights = useRef({ plan: 0, active: 0, backlog: 0 });

  const beginDrag = () => {
    const sections = containerRef.current?.querySelectorAll(
      '.dispatcher-section',
    );
    if (!sections || sections.length !== 3) return;
    const [plan, active, backlog] = [...sections].map(
      (section) => section.getBoundingClientRect().height,
    );
    startHeights.current = { plan, active, backlog };
  };

  const resizePlan = (delta: number) => {
    const start = startHeights.current;
    const applied = clamp(
      delta,
      DISPATCHER_SECTION_HEADER_HEIGHT - start.plan, // PLAN can shrink down to its header
      start.active - DISPATCHER_SECTION_HEADER_HEIGHT, // ACTIVE can shrink down to its header
    );
    setWeights({
      plan: start.plan + applied,
      active: start.active - applied,
      backlog: start.backlog,
    });
  };

  const resizeActive = (delta: number) => {
    const start = startHeights.current;
    const applied = clamp(
      delta,
      DISPATCHER_SECTION_HEADER_HEIGHT - start.active,
      start.backlog - DISPATCHER_SECTION_HEADER_HEIGHT,
    );
    setWeights({
      plan: start.plan,
      active: start.active + applied,
      backlog: start.backlog - applied,
    });
  };

  return { beginDrag, resizePlan, resizeActive };
};
