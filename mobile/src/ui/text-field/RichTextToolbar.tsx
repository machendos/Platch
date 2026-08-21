import './RichTextToolbar.css';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
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
import type { ListType } from '@lexical/list';
import { useActiveField } from './richText/activeField';
import { ceilingFor, toolbarTopWithin } from './richText/anchorToolbar';
import {
  $lineListType,
  $removeLineList,
  $setLineListType,
} from './richText/lineList';

type Marks = {
  bold: boolean;
  italic: boolean;
  list: ListType | null;
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
  const [marks, setMarks] = useState<Marks>(NO_MARKS);
  const bar = useRef<HTMLDivElement>(null);

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

        setMarks({
          bold: selection.hasFormat('bold'),
          italic: selection.hasFormat('italic'),
          list: $lineListType(),
        });
      });

    read();
    return editor.registerUpdateListener(read);
  }, [editor]);

  /* Followed frame by frame rather than by listening for scrolls. A scroll
     listener is the obvious approach and it is not dependable here: the
     scroller lives in ion-content's shadow root and is only handed over
     asynchronously, and iOS does not deliver scroll events during momentum the
     way a desktop browser does. Neither shows up in a preview browser driven
     with synthetic events, which is exactly how this shipped broken once.

     A frame loop has none of those failure modes. It costs one rect read per
     frame, only while a formatted field has focus, and the write is guarded on
     the value changing — so a still page does no style work at all. It also
     subsumes the resize and grow cases that needed their own observers. */
  useLayoutEffect(() => {
    const field = active?.shell;
    const element = bar.current;
    if (!field || !element) return;

    let frame = 0;
    let last: number | null = null;

    const follow = () => {
      const top = toolbarTopWithin(
        field.getBoundingClientRect(),
        ceilingFor(field),
        element.offsetHeight,
      );

      if (top !== last) {
        last = top;
        element.style.setProperty('--rich-toolbar-top', `${top}px`);
      }

      frame = requestAnimationFrame(follow);
    };

    follow();
    return () => cancelAnimationFrame(frame);
  }, [active]);

  if (!active) return null;

  const run = (command: () => void) => {
    active.editor.focus();
    command();
  };

  /* Both sides act on the caret's line only. Lexical's own INSERT_*_LIST and
     REMOVE_LIST commands are written for a document toolbar and take the whole
     containing list — or, removing, the whole top-level one at every depth. */
  const toggleList = (type: ListType) =>
    run(() =>
      active.editor.update(() =>
        marks.list === type ? $removeLineList() : $setLineListType(type),
      ),
    );

  const toolbar = (
    <div
      ref={bar}
      className="rich-toolbar"
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
        onPress={() => toggleList('number')}
      >
        <IonIcon icon={listOutline} />
      </ToolbarButton>

      <ToolbarButton
        label="Checklist"
        active={marks.list === 'check'}
        onPress={() => toggleList('check')}
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

  /* Rendered into the focused field rather than into the page, so it is
     positioned against the thing it is editing and moves with it. Out of flow
     throughout, so appearing shifts nothing. */
  return createPortal(toolbar, active.shell);
};
