import './RichTextField.css';

import { useRef, type CSSProperties } from 'react';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin';
import { ReportFocusPlugin } from './richText/ReportFocusPlugin';
import { RICH_TEXT_NODES } from './richText/nodes';
import {
  $readMarkdown,
  $writeMarkdown,
  RICH_TEXT_TRANSFORMERS,
} from './richText/markdown';
import { richTextTheme } from './richText/theme';

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
  // An editor owns its own state — selection, undo stack, node tree — so `value`
  // seeds it once and is never written back. Reseeding happens by remounting
  // (`key`). Both refs exist to tell our own emissions apart from a write from
  // outside, which is the one thing that silently does nothing.
  const shell = useRef<HTMLDivElement>(null);
  const seed = useRef(value);
  const lastEmitted = useRef(value);
  const warned = useRef(false);

  if (import.meta.env.DEV && value !== lastEmitted.current && !warned.current) {
    warned.current = true;
    console.warn(
      `Field ${id}: \`value\` changed from outside a formatted field. It seeds ` +
        'the editor once and is not applied again — remount with a `key` to ' +
        'load different content. See docs/rich-text.md.',
    );
  }

  const contentEditableProps = {
    id,
    className: 'field-editor field-input',
    'aria-labelledby': `${id}-label`,
  };

  return (
    <div
      ref={shell}
      className="field-rich"
      style={{ '--field-min-rows': minRows } as CSSProperties}
    >
      <LexicalComposer
        initialConfig={{
          namespace: 'field',
          nodes: RICH_TEXT_NODES,
          theme: richTextTheme,
          editorState: () => $writeMarkdown(seed.current),
          onError: (error) => {
            throw error;
          },
        }}
      >
        <RichTextPlugin
          contentEditable={
            placeholder ? (
              <ContentEditable
                {...contentEditableProps}
                aria-placeholder={placeholder}
                placeholder={
                  <span className="field-placeholder">{placeholder}</span>
                }
              />
            ) : (
              <ContentEditable {...contentEditableProps} />
            )
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <ListPlugin />
        {/* Without this Lexical calls domNode.focus() on the <li> when a
            checkbox is clicked, moving DOM focus off the contenteditable. That
            one line caused four separate symptoms: the toolbar vanished
            (Lexical fires BLUR, so the field stopped being the active one),
            SPACE toggled the checkbox instead of typing (KEY_SPACE_COMMAND
            fires whenever a check <li> holds focus), iOS showed its element
            callout instead of a caret menu, and which of those happened
            depended on exactly where the tap landed. The caret stays in the
            text now, and the checkbox toggles without claiming focus. */}
        <CheckListPlugin disableTakeFocusOnClick />
        <TabIndentationPlugin />
        <ReportFocusPlugin shell={shell} />
        <MarkdownShortcutPlugin transformers={RICH_TEXT_TRANSFORMERS} />
        <OnChangePlugin
          ignoreSelectionChange
          onChange={(editorState) => {
            editorState.read(() => {
              const markdown = $readMarkdown();
              if (markdown === lastEmitted.current) return;
              lastEmitted.current = markdown;
              onChange(markdown);
            });
          }}
        />
      </LexicalComposer>
    </div>
  );
};
