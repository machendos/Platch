import { useEffect } from 'react';

/* Publishes how far a scroll container has been pushed above the top of the
   screen, as --visual-viewport-top on that container's own field.

   Ionic locks the body and scrolls inside ion-content, but the browser's own
   "scroll the focused input above the keyboard" acts on the *document*. It
   drags ion-content — and everything positioned against it, sticky included —
   off the top. A sticky ceiling measured from ion-content is then measured
   from somewhere nobody can see.

   Measured, not assumed: the amount is whatever ion-content's own top has gone
   negative by. An earlier version used visualViewport.offsetTop, which is the
   same number only when ion-content begins at the top of the screen. In a
   sheet it does not, and adding the document's pan to a container-relative
   offset pushed the toolbar a couple of hundred pixels below its field.

   Nothing in CSS reports this. env(safe-area-inset-*) describes the device's
   cutouts and reads 0 in a browser tab; lvh/svh/dvh give chrome heights
   without saying whether the missing part is at the top or the bottom.

   It is not the per-frame chase that jittered when the toolbar was positioned
   from JS: this recomputes when the keyboard opens, closes or re-pans, and
   everything reading it stays CSS, so the sticky is still the compositor's. */
export const useVisualViewportTop = (field: HTMLElement | null) => {
  useEffect(() => {
    if (!field) return;

    const write = () => {
      const content = field.closest('ion-content');
      const top = content ? content.getBoundingClientRect().top : 0;

      field.style.setProperty(
        '--visual-viewport-top',
        `${Math.max(0, Math.round(-top))}px`,
      );
    };

    write();

    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', write);
    viewport?.addEventListener('scroll', write);

    return () => {
      viewport?.removeEventListener('resize', write);
      viewport?.removeEventListener('scroll', write);
      field.style.removeProperty('--visual-viewport-top');
    };
  }, [field]);
};
