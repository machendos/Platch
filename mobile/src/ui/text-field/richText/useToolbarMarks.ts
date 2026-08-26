import { useEffect, useState } from 'react';
import { $getSelection, $isRangeSelection, type LexicalEditor } from 'lexical';
import type { ListType } from '@lexical/list';
import { $lineListType } from './lineList';

/** What the caret is currently sitting in, as the toolbar needs to show it. */
export type Marks = {
  bold: boolean;
  italic: boolean;
  list: ListType | null;
};

const NONE: Marks = { bold: false, italic: false, list: null };

export const useToolbarMarks = (editor: LexicalEditor | null): Marks => {
  const [marks, setMarks] = useState<Marks>(NONE);

  useEffect(() => {
    if (!editor) {
      setMarks(NONE);
      return;
    }

    const read = () =>
      editor.getEditorState().read(() => {
        const selection = $getSelection();

        setMarks(
          $isRangeSelection(selection)
            ? {
                bold: selection.hasFormat('bold'),
                italic: selection.hasFormat('italic'),
                list: $lineListType(),
              }
            : NONE,
        );
      });

    read();
    return editor.registerUpdateListener(read);
  }, [editor]);

  return marks;
};
