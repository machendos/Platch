/* Which device the user is driving the app with, stamped on the document so
   the focus ring in index.css can be shown to someone navigating by keyboard
   and never to someone who has just tapped.

   `:focus-visible` alone does not answer this. An overlay closing hands focus
   back to the control that opened it, and the browser counts that restored
   focus as keyboard focus — which is why tapping the date frame or a project
   row left a system-blue ring behind once the picker or the modal closed.

   Only keys that *move* focus count. Enter, Space and Escape activate or
   dismiss something the pointer already chose, so they leave the modality
   alone; a tap followed by Escape is still a tap. */

const NAVIGATION_KEYS = new Set([
  'Tab',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);

export const watchInputModality = () => {
  const set = (modality: 'pointer' | 'keyboard') =>
    document.documentElement.setAttribute('data-modality', modality);

  /* Capture, so a handler that stops propagation cannot leave the modality
     stale — every gesture has to be counted, not just the ones that reach the
     document. */
  window.addEventListener('pointerdown', () => set('pointer'), true);
  window.addEventListener(
    'keydown',
    (event) => {
      if (NAVIGATION_KEYS.has(event.key)) set('keyboard');
    },
    true,
  );
};
