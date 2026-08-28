import { Extension } from '@tiptap/react';

/* Tab must never leave the editor. When a list item cannot sink any further,
   the list extensions decline the key, nothing else claims it, and the browser
   falls back to focus traversal — which walks straight into the checklist's
   real <input type="checkbox"> elements and lights them up one by one, looking
   for all the world like a screen reader had switched itself on.

   Returning true says "handled" without doing anything, so the real sink and
   lift still run: this is registered at the lowest priority, so it is only
   ever reached once every extension that wanted the key has passed. */
export const TabGuard = Extension.create({
  name: 'tabGuard',
  priority: 1,

  addKeyboardShortcuts() {
    return {
      Tab: () => true,
      'Shift-Tab': () => true,
    };
  },
});
