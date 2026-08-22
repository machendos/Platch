import { useEffect } from 'react';

/* Publishes how far iOS has panned the page up, as --visual-viewport-top.

   Ionic locks the body and scrolls inside ion-content, but the browser's own
   "scroll the focused input above the keyboard" acts on the *document*. It
   drags ion-content — and everything positioned against it, sticky included —
   off the top of the screen. Measured on a phone with a field focused:
   ion-content's top at -88 (Chrome) and -122 (Safari), matching
   document.scrollingElement.scrollTop and visualViewport.offsetTop exactly.

   Nothing in CSS reports this. env(safe-area-inset-*) describes the device's
   cutouts and reads 0 in a browser tab; lvh/svh/dvh describe chrome heights
   and cannot say whether the missing part is at the top or the bottom. The
   visual viewport is the only thing that knows, and it is JavaScript-only —
   which is the whole reason this hook exists rather than a CSS expression.

   It is not the per-frame chase that jittered when the toolbar was positioned
   from JS: this changes when the keyboard opens, closes, or re-pans, a handful
   of times a minute. Everything reading it stays CSS, so the sticky itself is
   still handled by the compositor. */
export const useVisualViewportTop = () => {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const write = () =>
      document.documentElement.style.setProperty(
        '--visual-viewport-top',
        `${Math.max(0, Math.round(viewport.offsetTop))}px`,
      );

    write();
    viewport.addEventListener('resize', write);
    viewport.addEventListener('scroll', write);

    return () => {
      viewport.removeEventListener('resize', write);
      viewport.removeEventListener('scroll', write);
      document.documentElement.style.removeProperty('--visual-viewport-top');
    };
  }, []);
};
