import { useCallback, useRef, useState } from 'react';
import type { RefObject } from 'react';

export type PopoverAnchor = {
  side: 'top' | 'bottom';
  originX: number;
};

export const usePopoverAnchor = (
  popover: RefObject<HTMLIonPopoverElement | null>,
  trigger: RefObject<HTMLElement | null>,
) => {
  const [anchor, setAnchor] = useState<PopoverAnchor | null>(null);
  const observer = useRef<MutationObserver | null>(null);

  const measure = useCallback(() => {
    const content =
      popover.current?.shadowRoot?.querySelector<HTMLElement>(
        '.popover-content',
      );
    if (!content?.style.top) return false;

    const panel = content.getBoundingClientRect();
    const handle = trigger.current?.getBoundingClientRect();

    setAnchor({
      side: content.style.transformOrigin.includes('bottom') ? 'top' : 'bottom',
      originX: handle
        ? Math.min(
            Math.max(handle.left + handle.width / 2 - panel.left, 0),
            panel.width,
          )
        : panel.width,
    });

    return true;
  }, [popover, trigger]);

  const watch = useCallback(() => {
    const content =
      popover.current?.shadowRoot?.querySelector<HTMLElement>(
        '.popover-content',
      );
    if (!content || measure()) return;

    observer.current?.disconnect();
    observer.current = new MutationObserver(() => {
      if (measure()) observer.current?.disconnect();
    });
    observer.current.observe(content, {
      attributes: true,
      attributeFilter: ['style'],
    });
  }, [measure, popover]);

  const reset = useCallback(() => {
    observer.current?.disconnect();
    observer.current = null;
    setAnchor(null);
  }, []);

  return { anchor, watch, reset };
};
