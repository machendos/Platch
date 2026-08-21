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

    const viewport = window.visualViewport;
    if (!viewport) return;

    // What the layout viewport has that the visual one does not is the
    // keyboard, plus anything else the browser has pushed in front of it.
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
