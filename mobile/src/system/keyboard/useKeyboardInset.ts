import { useEffect } from 'react';

/* Publishes how much of the layout viewport the keyboard is covering, as
   --keyboard-inset on the document.

   A mobile browser does not shrink the layout viewport when the keyboard
   opens — it just covers the bottom of it. So a scroll container's range ends
   where its content ends, with nowhere to put the last lines except behind the
   keys. Reserving the covered height as padding is what gives them somewhere
   to go.

   This was written once before and looked like it did nothing. It was correct;
   the document pan was eating the whole effect (see useReleaseKeyboardPan).
   Neither half works without the other: releasing the pan makes the top
   reachable, and this makes the bottom reachable.

   The formula is self-correcting across surfaces, so there is no branch on
   platform. In a browser the layout viewport stays put while
   visualViewport.height shrinks, so this is the keyboard's height. In the
   installed app Capacitor's `native` resize shrinks the webview itself, so
   both numbers shrink together and this is 0 — correct, because the layout has
   already been made smaller and padding would double-count. Measured:
   innerHeight 844 -> 509 with vv.height matching, in the app. */
export const useKeyboardInset = () => {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const write = () => {
      const covered = window.innerHeight - viewport.height - viewport.offsetTop;

      document.documentElement.style.setProperty(
        '--keyboard-inset',
        `${Math.max(0, Math.round(covered))}px`,
      );
    };

    write();
    viewport.addEventListener('resize', write);
    viewport.addEventListener('scroll', write);

    return () => {
      viewport.removeEventListener('resize', write);
      viewport.removeEventListener('scroll', write);
      document.documentElement.style.removeProperty('--keyboard-inset');
    };
  }, []);
};
