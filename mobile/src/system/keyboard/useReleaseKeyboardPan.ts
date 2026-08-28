import { useEffect } from 'react';
import type { RefObject } from 'react';

/* Hands the keyboard's document pan back to the scroller that can undo it.

   Ionic locks the body and scrolls inside ion-content. iOS does not know that:
   to lift the caret above the keyboard it pans the *document*, and on a locked
   body that pan belongs to no scroller at all. Nothing can scroll it back, so
   the panned distance is simply unreachable — that many pixels off the top,
   and the rest of the keyboard's height off the bottom. The two always sum to
   the keyboard, and which way it splits depends on where the caret was when
   the keyboard opened, which is why the number looks random: 196, 233, 101, 0.

   The same offset is what drags the toolbar off the top, so this is one bug
   wearing three faces — unreachable top, unreachable bottom, vanishing bar.

   Compensating for the offset in CSS was the old approach, and it could only
   ever move the symptom around — every consumer needed its own correction, and
   each one was wrong on a surface it had not been tested on. This moves the
   offset instead:
   add it to ion-content's own scrollTop, where it is an ordinary reachable
   scroll, and put the document back to zero. Net visual position is unchanged,
   so there is nothing to see — the content simply becomes scrollable again. */
export const useReleaseKeyboardPan = (
  content: RefObject<HTMLIonContentElement | null>,
) => {
  useEffect(() => {
    const doc = document.scrollingElement;
    if (!doc) return;

    let running = false;

    const release = async () => {
      const pan = doc.scrollTop;
      if (pan <= 0 || running) return;

      const host = content.current;
      if (!host) return;

      running = true;
      try {
        const scroller = await host.getScrollElement();
        // Order matters: take the offset first, then drop the pan, so the
        // content never appears to jump between the two writes.
        scroller.scrollTop += pan;
        doc.scrollTop = 0;
      } finally {
        running = false;
      }
    };

    const viewport = window.visualViewport;
    document.addEventListener('scroll', release, { passive: true });
    viewport?.addEventListener('resize', release);
    viewport?.addEventListener('scroll', release);

    return () => {
      document.removeEventListener('scroll', release);
      viewport?.removeEventListener('resize', release);
      viewport?.removeEventListener('scroll', release);
    };
  }, [content]);
};
