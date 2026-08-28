import { Placeholder } from '@tiptap/extensions';
import StarterKit from '@tiptap/starter-kit';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { MarkerFormatting } from './markerFormatting';
import { TabGuard } from './tabGuard';

/* Only what the markdown format can carry. An extension whose output the
   serializer cannot write would let a paste introduce content the field is
   unable to store, so headings, code, quotes, rules and strike are all off.

   hardBreak is off too, and that one is not obvious — markdown has no
   unambiguous single-line break, so a soft break would not survive a save. */
export const richTextExtensions = (placeholder?: string) => [
  StarterKit.configure({
    heading: false,
    blockquote: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
    strike: false,
    underline: false,
    hardBreak: false,
    trailingNode: false,

    // Autolink rather than a link button: a URL is recognised as it is typed
    // or pasted, and openOnClick stays off because navigating a WKWebView away
    // from the app leaves no way back. See docs/TODO.md.
    link: {
      autolink: true,
      linkOnPaste: true,
      openOnClick: false,
    },

    bold: { HTMLAttributes: { class: 'field-bold' } },
    italic: { HTMLAttributes: { class: 'field-italic' } },
    paragraph: { HTMLAttributes: { class: 'field-paragraph' } },
    bulletList: { HTMLAttributes: { class: 'field-list-ul' } },
    orderedList: { HTMLAttributes: { class: 'field-list-ol field-list-ol-1' } },
    listItem: { HTMLAttributes: { class: 'field-listitem' } },
  }),

  /* A real <input type="checkbox"> inside a contenteditable="false" label.
     That is what keeps ticking a box from touching the caret: no synthetic hit
     zone to steal taps meant for the words, and no element that takes DOM
     focus away from the editable when pressed. */
  TaskList.configure({ HTMLAttributes: { class: 'field-checklist' } }),
  TaskItem.configure({
    nested: true,
    HTMLAttributes: { class: 'field-checkitem' },
  }),

  MarkerFormatting,
  TabGuard,

  Placeholder.configure({
    placeholder: placeholder ?? '',
    emptyEditorClass: 'field-empty',
  }),
];
