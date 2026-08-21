import { useEffect } from 'react';
import type { RefObject } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { BLUR_COMMAND, COMMAND_PRIORITY_LOW, FOCUS_COMMAND } from 'lexical';
import { useActiveField } from './activeField';

/* Lexical's own FOCUS/BLUR commands rather than DOM handlers: the editable
   element is replaced when the editor re-registers its root, so a listener
   bound to the node it had at mount would stop firing. */
export const ReportFocusPlugin = ({
  shell,
}: {
  shell: RefObject<HTMLElement | null>;
}) => {
  const [editor] = useLexicalComposerContext();
  const { setActive } = useActiveField();

  useEffect(() => {
    const focused = editor.registerCommand(
      FOCUS_COMMAND,
      () => {
        // Anchor on the whole field, not on the editable inside it, so the
        // toolbar rises clear of the label rather than covering the name of
        // the thing being edited. FieldShell's `.field` is the boundary — the
        // same one call sites already style through.
        const anchor = shell.current?.closest<HTMLElement>('.field');
        if (anchor) setActive({ editor, shell: anchor });
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );

    // The toolbar's buttons cancel mousedown so pressing one never blurs the
    // editor. Anything that does blur it is a real move away, so the toolbar
    // should go with it.
    const blurred = editor.registerCommand(
      BLUR_COMMAND,
      () => {
        setActive(null);
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );

    return () => {
      focused();
      blurred();
    };
  }, [editor, setActive, shell]);

  return null;
};
