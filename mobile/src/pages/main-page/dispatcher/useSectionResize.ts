import { useRef } from 'react';
import type { RefObject } from 'react';
import { SECTION_MIN_HEIGHT } from './layoutConfig';
import { clamp } from '../../../system/helpers/helpers';
import type { SectionWeights } from '../layoutStorage';

/* How much of a drag the pair either side of a seam can actually take, and
   whether that was all of it — the seam greys its grip when it was not.

   Exported for its own test: the hook around it needs three laid-out sections
   before it can say anything, and this is the part that can be wrong.

   A pair already under the floor has nothing to trade, and its bounds come out
   inverted — `clamp` then returns its maximum, which is below its minimum, and
   pushes a section further past the floor instead of stopping it. */
export const applySectionDrag = (
  delta: number,
  above: number,
  below: number,
) => {
  const lower = SECTION_MIN_HEIGHT - above;
  const upper = below - SECTION_MIN_HEIGHT;
  const applied = lower > upper ? 0 : clamp(delta, lower, upper);

  return { applied, bound: applied !== delta };
};

export const useSectionResize = (
  containerRef: RefObject<HTMLDivElement | null>,
  setWeights: (weights: SectionWeights) => void,
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
    const { applied, bound } = applySectionDrag(
      delta,
      start.plan,
      start.active,
    );

    setWeights({
      plan: start.plan + applied,
      active: start.active - applied,
      backlog: start.backlog,
    });
    return bound;
  };

  const resizeActive = (delta: number) => {
    const start = startHeights.current;
    const { applied, bound } = applySectionDrag(
      delta,
      start.active,
      start.backlog,
    );

    setWeights({
      plan: start.plan,
      active: start.active + applied,
      backlog: start.backlog - applied,
    });
    return bound;
  };

  return { beginDrag, resizePlan, resizeActive };
};
