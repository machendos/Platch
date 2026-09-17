import './press.css';

import { useCallback, useEffect, useRef } from 'react';
import type { Ref } from 'react';
import { pressHaptic } from '../../../system/feedback/pressHaptic';

/* :active cannot drive this. The press is held and the release is an
   animation, and a browser drops :active the instant the pointer leaves the
   element — which would cancel the spring rather than start it, and on iOS
   also whenever the page scrolls under the finger. So the state is two
   classes, set from pointer events, and the release is cleared when its own
   animation ends rather than on a timer that could drift from it. */

type Options<T> = {
  haptic?: boolean;
  /** The visible half. Off for a control that already answers a press some
      other way — a toggle whose own selected fill says it, or a trigger whose
      answer is the panel it opens — where a press state on top of that is a
      second, quieter reply to the same tap. Stated here rather than by a
      caller dropping `className` on the floor, so the exception is legible. */
  animate?: boolean;
  /** Merged rather than replaced. A host that already owes its ref to someone
      else — Mobiscroll anchors its picker to one, PopoverMenu positions its
      panel against one — still needs this hook to reach the element, and
      choosing between the two silently costs whichever lost. */
  ref?: Ref<T>;
};

const PRESSING = 'is-pressing';
const RELEASING = 'is-releasing';

export const usePress = <T extends HTMLElement = HTMLButtonElement>({
  haptic = true,
  animate = true,
  ref: borrowed,
}: Options<T> = {}) => {
  const ref = useRef<T | null>(null);

  const attach = useCallback(
    (el: T | null) => {
      ref.current = el;
      if (typeof borrowed === 'function') borrowed(el);
      else if (borrowed) borrowed.current = el;
    },
    [borrowed],
  );

  const isDisabled = (el: T) =>
    (el as HTMLElement & { disabled?: boolean }).disabled === true ||
    el.getAttribute('aria-disabled') === 'true';

  const onPointerDown = useCallback(() => {
    const el = ref.current;
    if (!el || isDisabled(el)) return;

    if (animate) {
      el.classList.remove(RELEASING);
      el.classList.add(PRESSING);
    }
    if (haptic) pressHaptic();
  }, [haptic, animate]);

  const release = useCallback(() => {
    const el = ref.current;
    if (!el || !el.classList.contains(PRESSING)) return;

    el.classList.remove(PRESSING);
    // Remove, read layout, re-add: without the read the class never leaves the
    // computed style, and a second press inside the animation does nothing.
    el.classList.remove(RELEASING);
    void el.offsetWidth;
    el.classList.add(RELEASING);
  }, []);

  /* animationend rather than a timeout, so the class cannot outlive an
     animation the browser shortened, and cannot be left behind by one it never
     ran (a hidden tab, reduced motion). */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const done = (event: AnimationEvent) => {
      if (event.animationName === 'press-release')
        el.classList.remove(RELEASING);
    };

    el.addEventListener('animationend', done);
    el.addEventListener('animationcancel', done);
    return () => {
      el.removeEventListener('animationend', done);
      el.removeEventListener('animationcancel', done);
    };
  }, []);

  return {
    ref: attach,
    className: animate ? 'pressable' : '',
    onPointerDown,
    onPointerUp: release,
    onPointerCancel: release,
    onPointerLeave: release,
  } as const;
};
