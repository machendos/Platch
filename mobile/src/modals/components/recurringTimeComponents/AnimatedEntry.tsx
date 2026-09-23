import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { REVEAL_MOTION } from '../../../config/revealMotion';
import { Reveal } from '../../../ui/reveal/Reveal';

type AnimatedEntryProps = {
  appear: boolean;
  leaving: boolean;
  onGone: () => void;
  children: ReactNode;
};

// A list entry that arrives and leaves through `Reveal`. Items present when
// the list first renders skip the entrance; a leaving item collapses first and
// only then reports `onGone`, which is when the caller drops it from state.
export const AnimatedEntry = ({
  appear,
  leaving,
  onGone,
  children,
}: AnimatedEntryProps) => {
  const [entered, setEntered] = useState(!appear);

  useEffect(() => {
    setEntered(true);
  }, []);

  useEffect(() => {
    if (!leaving) return;

    const timer = setTimeout(onGone, REVEAL_MOTION.durationMs);
    return () => clearTimeout(timer);
  }, [leaving, onGone]);

  return (
    <Reveal when={entered && !leaving} intoView>
      {children}
    </Reveal>
  );
};
