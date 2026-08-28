import type { Editor } from '@tiptap/react';
import {
  NO_MARKS,
  type EditorAdapter,
  type ListType,
  type Marks,
} from '../toolbar/adapter';

const LIST_FOR: Record<ListType, string> = {
  number: 'orderedList',
  bullet: 'bulletList',
  check: 'taskList',
};

/* Indent and outdent have to name the item type, and a checklist's item is a
   different node from a plain list's. Try the task item first and fall back:
   whichever the caret is actually in, the other command is a no-op that
   reports false. */
const shift = (editor: Editor, direction: 'sink' | 'lift') => {
  const run = (name: string) =>
    direction === 'sink'
      ? editor.chain().focus().sinkListItem(name).run()
      : editor.chain().focus().liftListItem(name).run();

  if (!run('taskItem')) run('listItem');
};

export const tiptapAdapter = (editor: Editor): EditorAdapter => ({
  focus: () => editor.commands.focus(),

  toggleBold: () => editor.chain().focus().toggleBold().run(),
  toggleItalic: () => editor.chain().focus().toggleItalic().run(),

  /* Per-line by construction: the toggles act on the block the caret is in and
     split the list themselves, and they apply across a multi-line selection.
     Toggling the kind a line already is turns it back to a paragraph, so one
     button both sets and clears. */
  toggleList: (type) => {
    const chain = editor.chain().focus();
    if (type === 'number') chain.toggleOrderedList().run();
    else if (type === 'bullet') chain.toggleBulletList().run();
    else chain.toggleTaskList().run();
  },

  /* On a line that is already in a list, indent nests it. On a plain line
     there is nothing to nest, and doing nothing reads as a broken button — so
     it starts a numbered list instead, the same kind the list control makes.
     Outdent has no such case: a plain line is already as far left as it goes. */
  indent: () => {
    const inList = ['orderedList', 'bulletList', 'taskList'].some((name) =>
      editor.isActive(name),
    );

    if (inList) shift(editor, 'sink');
    else editor.chain().focus().toggleOrderedList().run();
  },

  outdent: () => shift(editor, 'lift'),

  readMarks: (): Marks => {
    if (editor.isDestroyed) return NO_MARKS;

    const list =
      (Object.keys(LIST_FOR) as ListType[]).find((type) =>
        editor.isActive(LIST_FOR[type]),
      ) ?? null;

    return {
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      list,
    };
  },

  // `transaction` covers both content and selection changes, which is exactly
  // the pair the bar has to repaint for.
  subscribe: (listener) => {
    editor.on('transaction', listener);
    return () => {
      editor.off('transaction', listener);
    };
  },
});
