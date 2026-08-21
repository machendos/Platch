import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

/* One number, and everything that has to clear the software keyboard reads
   only this. The platforms disagree about the mechanism — iOS reports a height
   through Capacitor, Android depends on the resize mode it was configured
   with, a desktop browser has no keyboard at all — but they agree about the
   question. Keeping the disagreement inside one hook is what makes Android a
   change here rather than a redesign of whatever is sitting on the keyboard.

   Named and published as --keyboard-inset for the same reason Modal.css names
   its safe areas: a value that reads zero everywhere except a device is
   otherwise impossible to test against. */
export const useKeyboardInset = () => {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const shown = Keyboard.addListener('keyboardWillShow', (info) =>
        setInset(info.keyboardHeight),
      );
      const hidden = Keyboard.addListener('keyboardWillHide', () =>
        setInset(0),
      );

      return () => {
        void shown.then((handle) => handle.remove());
        void hidden.then((handle) => handle.remove());
      };
    }

    /* In a browser this reports 0 for as long as Ionic is holding the document
       still, and that is not a bug here — it is the platform.

       iOS shrinks the visual viewport for the keyboard only when the *document*
       scrolls. Ionic locks the body and scrolls inside ion-content instead, so
       iOS overlays the keyboard and leaves the viewport alone: measured on an
       iPhone 17 with the keyboard up, innerHeight and visualViewport.height are
       both 714. The same page outside Ionic reports 714 and 367.

       Ionic's own detection has the identical limitation — @ionic/core reaches
       for the Capacitor plugin first and falls back to visualViewport.onresize,
       so ionKeyboardDidShow does not fire here either. Nothing a web page can
       read distinguishes the two states, and Ionic's answer is to guess with a
       keyboardHeight config default of 290, which is a device-specific number
       dressed up as a constant.

       So the browser keeps the anchored toolbar, and the keyboard dock is a
       native-app behaviour. Left as viewport arithmetic rather than a hardcoded
       zero because it is correct wherever the document does scroll. */
    const viewport = window.visualViewport;
    if (!viewport) return;

    const read = () =>
      setInset(
        Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop),
      );

    read();
    viewport.addEventListener('resize', read);
    viewport.addEventListener('scroll', read);

    return () => {
      viewport.removeEventListener('resize', read);
      viewport.removeEventListener('scroll', read);
    };
  }, []);

  return inset;
};
