import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

type Container = { contains: (node: Node) => boolean } | null | undefined;

export const useDismissOnOutside = (
  isOpen: boolean,
  inside: readonly RefObject<Container>[],
  onOutside: () => void,
) => {
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
