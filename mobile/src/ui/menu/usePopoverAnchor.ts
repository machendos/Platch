import { useCallback, useRef, useState } from 'react';
import type { RefObject } from 'react';

export type PopoverAnchor = {
  /* Which side of the trigger the panel actually settled on. Ionic flips to
     'top' by itself when there is no room below, and reports the side that was
     *asked* for on the host, so this is read from where it landed. */
  side: 'top' | 'bottom';
  /* Where the trigger's centre falls along the panel's width, in px from the
     panel's left edge. The panel grows out of that point rather than out of a
     corner it may not be anywhere near. */
  originX: number;
};

/* Ionic writes the panel's position onto its own shadow content, and only once
   it builds the enter animation — after `ionPopoverWillPresent` and long before
   `ionPopoverDidPresent`. Reading it at didPresent means correcting a frame
   late, which shows as a visible jump.

   So this watches for that write instead. A MutationObserver on the style
   attribute fires in the microtask straight after it, before the frame is
   painted, and disconnects on the first hit. */
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
      /* Ionic writes `right bottom` when it put the panel above the trigger,
         `right top` when below. It is the only honest signal of the outcome. */
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
