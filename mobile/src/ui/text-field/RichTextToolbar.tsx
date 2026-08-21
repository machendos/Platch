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
import {
  ceilingFor,
  scrollerFor,
  toolbarTopWithin,
} from './richText/anchorToolbar';
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

  /* Layout, not state: the top is written straight onto the element so a
     scroll does not re-render the toolbar, and useLayoutEffect places it
     before the first paint so it never flashes at the wrong height. */
  useLayoutEffect(() => {
    const field = active?.shell;
    const element = bar.current;
    if (!field || !element) return;

    const place = () => {
      element.style.setProperty(
        '--rich-toolbar-top',
        `${toolbarTopWithin(
          field.getBoundingClientRect(),
          ceilingFor(field),
          element.offsetHeight,
        )}px`,
      );
    };

    place();

    // The field grows as the text does, which moves everything below it.
    const resized = new ResizeObserver(place);
    resized.observe(field);
    window.addEventListener('resize', place);

    let detach: (() => void) | undefined;
    let dropped = false;

    void scrollerFor(field).then((scroller) => {
      if (dropped) return;
      scroller.addEventListener('scroll', place, { passive: true });
      detach = () => scroller.removeEventListener('scroll', place);
      place();
    });

    return () => {
      dropped = true;
      detach?.();
      resized.disconnect();
      window.removeEventListener('resize', place);
    };
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

  /* Rendered into the focused field rather than into the page. Anchored, it
     then moves with the content and needs no scroll listener at all; docked to
     the keyboard it is fixed, and the portal only decides which stacking
     context it lands in. Either way it is out of flow, so appearing shifts
     nothing. */
  return createPortal(toolbar, active.shell);
};
