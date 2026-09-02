import { useEffect } from 'react';
import type { RefObject } from 'react';

/* Shared by every block that opens an inline picker: the panel closes when
   the gesture that started outside it ends. */
export const useOutsideClose = (
  root: RefObject<HTMLDivElement | null>,
  active: boolean,
  close: () => void,
) => {
  useEffect(() => {
    if (!active) return;

    let armed = false;
    let insideGesture = false;

    const inside = (event: Event) =>
      event.target instanceof Node &&
      root.current?.contains(event.target) === true;

    // Acted on at pointerup rather than pointerdown: closing collapses the
    // panel and moves everything below it, and a click resolves from where the
    // pointer sits when the gesture ends. Same rule TimeInput follows.
    const noticePointerDown = (event: Event) => {
      armed = !inside(event);
      insideGesture = !armed;
    };

    const closeAfterGesture = () => {
      insideGesture = false;
      if (!armed) return;
      armed = false;
      close();
    };

    // A focus change during a gesture that started inside is not the user
    // leaving: a mouse-down on the non-focusable wheel blurs the trigger and
    // Ionic's focus trap re-focuses the modal host — outside this editor —
    // which used to close the panel the moment a desktop drag began.
    const closeOnFocusElsewhere = (event: Event) => {
      if (armed || insideGesture || inside(event)) return;
      close();
    };

    document.addEventListener('pointerdown', noticePointerDown, true);
    document.addEventListener('pointerup', closeAfterGesture, true);
    document.addEventListener('pointercancel', closeAfterGesture, true);
    document.addEventListener('focusin', closeOnFocusElsewhere, true);

    return () => {
      document.removeEventListener('pointerdown', noticePointerDown, true);
      document.removeEventListener('pointerup', closeAfterGesture, true);
      document.removeEventListener('pointercancel', closeAfterGesture, true);
      document.removeEventListener('focusin', closeOnFocusElsewhere, true);
    };
  }, [root, active, close]);
};
