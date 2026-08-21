import './RichTextToolbar.css';

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IonIcon } from '@ionic/react';
import {
  checkboxOutline,
  chevronBack,
  chevronForward,
  listOutline,
} from 'ionicons/icons';
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  INDENT_CONTENT_COMMAND,
  OUTDENT_CONTENT_COMMAND,
} from 'lexical';
import {
  $isListNode,
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  ListNode,
  REMOVE_LIST_COMMAND,
} from '@lexical/list';
import { $getNearestNodeOfType } from '@lexical/utils';
import { useKeyboardInset } from '../../system/keyboard/useKeyboardInset';
import { useActiveField } from './richText/activeField';

type Marks = {
  bold: boolean;
  italic: boolean;
  list: 'number' | 'check' | 'bullet' | null;
};

const NO_MARKS: Marks = { bold: false, italic: false, list: null };

const ToolbarButton = ({
  label,
  active,
  onPress,
  children,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  children: ReactNode;
}) => (
  <button
    className={
      active
        ? 'rich-toolbar-button rich-toolbar-button-active'
        : 'rich-toolbar-button'
    }
    type="button"
    aria-label={label}
    aria-pressed={active}
    // The editor must keep the caret and the selection the command is about to
    // act on. Without this the button takes focus, the selection collapses,
    // and the command has nothing to apply to.
    onMouseDown={(event) => event.preventDefault()}
    onClick={onPress}
  >
    {children}
  </button>
);

export const RichTextToolbar = () => {
  const { active } = useActiveField();
  const keyboardInset = useKeyboardInset();
  const [marks, setMarks] = useState<Marks>(NO_MARKS);

  const editor = active?.editor ?? null;

  useEffect(() => {
    if (!editor) {
      setMarks(NO_MARKS);
      return;
    }

    const read = () =>
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return setMarks(NO_MARKS);

        const anchor = selection.anchor.getNode();
        const list = $getNearestNodeOfType<ListNode>(anchor, ListNode);

        setMarks({
          bold: selection.hasFormat('bold'),
          italic: selection.hasFormat('italic'),
          list: $isListNode(list) ? list.getListType() : null,
        });
      });

    read();
    return editor.registerUpdateListener(read);
  }, [editor]);

  if (!active) return null;

  const run = (command: () => void) => {
    active.editor.focus();
    command();
  };

  const toggleList = (
    type: 'number' | 'check',
    command:
      | typeof INSERT_ORDERED_LIST_COMMAND
      | typeof INSERT_CHECK_LIST_COMMAND,
  ) =>
    run(() =>
      marks.list === type
        ? active.editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
        : active.editor.dispatchCommand(command, undefined),
    );

  const toolbar = (
    <div
      className={
        keyboardInset > 0
          ? 'rich-toolbar rich-toolbar-on-keyboard'
          : 'rich-toolbar rich-toolbar-anchored'
      }
      style={{ '--keyboard-inset': `${keyboardInset}px` } as CSSProperties}
      role="toolbar"
      aria-label="Formatting"
      data-rich-toolbar=""
    >
      <ToolbarButton
        label="Bold"
        active={marks.bold}
        onPress={() =>
          run(() => active.editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold'))
        }
      >
        <span className="rich-toolbar-glyph rich-toolbar-glyph-bold">B</span>
      </ToolbarButton>

      <ToolbarButton
        label="Italic"
        active={marks.italic}
        onPress={() =>
          run(() =>
            active.editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic'),
          )
        }
      >
        <span className="rich-toolbar-glyph rich-toolbar-glyph-italic">I</span>
      </ToolbarButton>

      <span className="rich-toolbar-divider" aria-hidden="true" />

      <ToolbarButton
        label="Numbered list"
        active={marks.list === 'number'}
        onPress={() => toggleList('number', INSERT_ORDERED_LIST_COMMAND)}
      >
        <IonIcon icon={listOutline} />
      </ToolbarButton>

      <ToolbarButton
        label="Checklist"
        active={marks.list === 'check'}
        onPress={() => toggleList('check', INSERT_CHECK_LIST_COMMAND)}
      >
        <IonIcon icon={checkboxOutline} />
      </ToolbarButton>

      <span className="rich-toolbar-divider" aria-hidden="true" />

      {/* Tab and Shift+Tab do this on a keyboard, and no software keyboard has
          a Tab key — not iOS, not Gboard. On a phone these are the only way to
          nest, which is why they are here rather than being a nicety. */}
      <ToolbarButton
        label="Outdent"
        onPress={() =>
          run(() =>
            active.editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined),
          )
        }
      >
        <IonIcon icon={chevronBack} />
      </ToolbarButton>

      <ToolbarButton
        label="Indent"
        onPress={() =>
          run(() =>
            active.editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined),
          )
        }
      >
        <IonIcon icon={chevronForward} />
      </ToolbarButton>
    </div>
  );

  /* Rendered into the focused field rather than into the page. Anchored, it
     then moves with the content and needs no scroll listener at all; docked to
     the keyboard it is fixed, and the portal only decides which stacking
     context it lands in. Either way it is out of flow, so appearing shifts
     nothing. */
  return createPortal(toolbar, active.shell);
};
