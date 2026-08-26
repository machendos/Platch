import './Reveal.css';

import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { REVEAL_MOTION } from '../../config/revealMotion';

export type RevealAxis = 'block' | 'inline';

export type RevealProps = {
  when: boolean;
  axis?: RevealAxis;
  /** Scrolls the reveal into view as it grows, riding the expansion frame by
      frame the way TimeInput's panel does — `nearest` asks for a few pixels at
      a time and is a no-op for content that already fits. Only a real closed →
      open transition follows; content open at mount stays where it is. */
  intoView?: boolean;
  /** Keeps the children mounted while closed — collapsed to nothing and
      `visibility: hidden`, so they cost layout but stay out of the tab order.
      For content whose mount is expensive enough to feel (an inline calendar);
      cheap content should keep the default and unmount. */
  keepMounted?: boolean;
  className?: string;
  children: ReactNode;
};

export const Reveal = ({
  when,
  axis = 'block',
  intoView = false,
  keepMounted = false,
  className,
  children,
}: RevealProps) => {
  const [lingering, setLingering] = useState(false);
  const [open, setOpen] = useState(when);
  const [settled, setSettled] = useState(when);
  const root = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(when);

  useLayoutEffect(() => {
    const opening = when && !wasOpen.current;
    wasOpen.current = when;

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

      // requestAnimationFrame is fine here where it is not for the state
      // machine above: in a hidden page the scroll simply does not happen,
      // which costs nothing.
      let frame = 0;
      if (opening && intoView) {
        const started = performance.now();
        frame = requestAnimationFrame(function follow() {
          root.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });

          if (performance.now() - started < REVEAL_MOTION.durationMs) {
            frame = requestAnimationFrame(follow);
          }
        });
      }

      return () => {
        clearTimeout(settle);
        cancelAnimationFrame(frame);
      };
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
  }, [when, intoView]);

  const hidden = !when && !lingering;
  if (hidden && !keepMounted) return null;

  const classes = ['reveal', `reveal-${axis}`];
  if (open) classes.push('reveal-open');
  if (settled) classes.push('reveal-settled');
  if (hidden) classes.push('reveal-hidden');
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
