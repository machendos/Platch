import './press.css';

import { useCallback, useEffect, useRef } from 'react';
import { pressHaptic } from '../../../system/feedback/pressHaptic';

/* :active cannot drive this. The press is held and the release is an
   animation, and a browser drops :active the instant the pointer leaves the
   element — which would cancel the spring rather than start it, and on iOS
   also whenever the page scrolls under the finger. So the state is two
   classes, set from pointer events, and the release is cleared when its own
   animation ends rather than on a timer that could drift from it. */

type Options = { haptic?: boolean };

const PRESSING = 'is-pressing';
const RELEASING = 'is-releasing';

export const usePress = <T extends HTMLElement = HTMLButtonElement>({
  haptic = true,
}: Options = {}) => {
  const ref = useRef<T>(null);

  const isDisabled = (el: T) =>
    (el as HTMLElement & { disabled?: boolean }).disabled === true ||
    el.getAttribute('aria-disabled') === 'true';

  const onPointerDown = useCallback(() => {
    const el = ref.current;
    if (!el || isDisabled(el)) return;

    el.classList.remove(RELEASING);
    el.classList.add(PRESSING);
    if (haptic) pressHaptic();
  }, [haptic]);

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
    ref,
    className: 'pressable',
    onPointerDown,
    onPointerUp: release,
    onPointerCancel: release,
    onPointerLeave: release,
  } as const;
};
