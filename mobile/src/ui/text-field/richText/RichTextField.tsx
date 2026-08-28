import '../RichTextField.css';

import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { dropSelectionInside } from '../staleSelection';
import { useActiveField } from '../toolbar/activeField';
import { richTextExtensions } from './extensions';
import { fromMarkdown, toMarkdown } from './markdown';
import { tiptapAdapter } from './tiptapAdapter';

type RichTextFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minRows: number;
};

export const RichTextField = ({
  id,
  value,
  onChange,
  placeholder,
  minRows,
}: RichTextFieldProps) => {
  // An editor owns its own state — selection, undo stack, document — so
  // `value` seeds it once and is never written back. Reseeding is a remount.
  const shell = useRef<HTMLDivElement>(null);
  const seed = useRef(value);
  const lastEmitted = useRef(value);
  const warned = useRef(false);
  const { setActive } = useActiveField();

  if (import.meta.env.DEV && value !== lastEmitted.current && !warned.current) {
    warned.current = true;
    console.warn(
      `Field ${id}: \`value\` changed from outside a formatted field. It seeds ` +
        'the editor once and is not applied again — remount with a `key` to ' +
        'load different content. See docs/rich-text.md.',
    );
  }

  const editor = useEditor({
    extensions: richTextExtensions(placeholder),
    content: fromMarkdown(seed.current),
    editorProps: {
      attributes: {
        id,
        class: 'field-editor field-input',
        'aria-labelledby': `${id}-label`,
        ...(placeholder ? { 'aria-placeholder': placeholder } : {}),
      },
    },
    onUpdate: ({ editor: current }) => {
      const markdown = toMarkdown(current.getJSON());
      if (markdown === lastEmitted.current) return;
      lastEmitted.current = markdown;
      onChange(markdown);
    },
  });

  const adapter = useMemo(
    () => (editor ? tiptapAdapter(editor) : null),
    [editor],
  );

  useEffect(() => {
    if (!editor || !adapter) return;

    // Anchor on the whole field, not the editable inside it, so the toolbar
    // rises clear of the label rather than covering the name of the thing
    // being edited.
    const onFocus = () => {
      const anchor = shell.current?.closest<HTMLElement>('.field');
      if (anchor) setActive({ adapter, shell: anchor });
    };

    /* Not every blur means the user left — iOS raises one when it puts up its
       Paste / Select callout, and the caret stays in the text throughout. So
       the question is asked of the DOM a tick later, once focus has landed
       wherever it is going. */
    const onBlur = () => {
      setTimeout(() => {
        if (editor.isDestroyed) return;
        if (editor.view.dom.contains(document.activeElement)) return;

        setActive(null);
        dropSelectionInside(editor.view.dom);
      }, 0);
    };

    editor.on('focus', onFocus);
    editor.on('blur', onBlur);

    return () => {
      editor.off('focus', onFocus);
      editor.off('blur', onBlur);
    };
  }, [adapter, editor, setActive]);

  return (
    <div
      ref={shell}
      className="field-rich"
      style={{ '--field-min-rows': minRows } as CSSProperties}
    >
      <EditorContent editor={editor} />
    </div>
  );
};
