import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/* Anything that can answer "is this node mine" — an IonPopover, a button, a
   field wrapper. Only `contains` is needed, so the hook does not care which. */
type Container = { contains: (node: Node) => boolean } | null | undefined;

/* Ionic popovers do not follow their trigger when the page moves, so a scroll
   would leave the panel stranded beside nothing. Dismissing is the honest
   answer.

   Capture phase, and by node identity rather than by selector, so a second
   panel of the same kind on the page cannot suppress this one.

   `wheel` is not fired by touch scrolling, so `scroll` is what covers the
   phone. Both are needed; `Select` had the pair and `HeaderMenu` had only
   `wheel`, which is the bug this hook closes by giving them one copy. */
export const useDismissOnOutside = (
  isOpen: boolean,
  inside: readonly RefObject<Container>[],
  onOutside: () => void,
) => {
  /* Held in a ref so a caller may pass a fresh array and a fresh closure every
     render without tearing the listeners down and putting them back. */
  const latest = useRef({ inside, onOutside });
  latest.current = { inside, onOutside };

  useEffect(() => {
    if (!isOpen) return;

    const dismissUnlessInside = (event: Event) => {
      const target = event.target as Node | null;
      if (!target) return;

      const { inside, onOutside } = latest.current;
      if (inside.some((ref) => ref.current?.contains(target))) return;

      onOutside();
    };

    const listened: AddEventListenerOptions = { capture: true, passive: true };
    const types = ['pointerdown', 'wheel', 'scroll'] as const;

    types.forEach((type) =>
      document.addEventListener(type, dismissUnlessInside, listened),
    );

    return () =>
      types.forEach((type) =>
        document.removeEventListener(type, dismissUnlessInside, listened),
      );
  }, [isOpen]);
};
