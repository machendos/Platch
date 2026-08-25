import './Reveal.css';

import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { REVEAL_MOTION } from '../../config/revealMotion';

export type RevealAxis = 'block' | 'inline';

export type RevealProps = {
  when: boolean;
  axis?: RevealAxis;
  className?: string;
  children: ReactNode;
};

export const Reveal = ({
  when,
  axis = 'block',
  className,
  children,
}: RevealProps) => {
  const [lingering, setLingering] = useState(false);
  const [open, setOpen] = useState(when);
  const [settled, setSettled] = useState(when);
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (when) {
      setLingering(true);

      // A transition needs a resolved state to leave, and the closed one has
      // only just been committed — reading layout is what resolves it. Not
      // requestAnimationFrame: it does not run in a hidden page, and the
      // content would mount and then stay collapsed for good.
      root.current?.getBoundingClientRect();
      setOpen(true);

      const settle = setTimeout(
        () => setSettled(true),
        REVEAL_MOTION.durationMs,
      );

      return () => clearTimeout(settle);
    }

    setOpen(false);
    setSettled(false);

    // A timer rather than `transitionend`, which never arrives under reduced
    // motion or in a hidden page — the content would stay mounted for good.
    const unmount = setTimeout(
      () => setLingering(false),
      REVEAL_MOTION.durationMs,
    );

    return () => clearTimeout(unmount);
  }, [when]);

  if (!when && !lingering) return null;

  const classes = ['reveal', `reveal-${axis}`];
  if (open) classes.push('reveal-open');
  if (settled) classes.push('reveal-settled');
  if (className) classes.push(className);

  return (
    <div
      ref={root}
      className={classes.join(' ')}
      style={
        {
          '--reveal-duration': `${REVEAL_MOTION.durationMs}ms`,
        } as CSSProperties
      }
    >
      <div className="reveal-content">{children}</div>
    </div>
  );
};
