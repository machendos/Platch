import type { ReactNode } from 'react';
import { IonIcon } from '@ionic/react';
import {
  checkboxOutline,
  chevronBack,
  chevronForward,
  listOutline,
} from 'ionicons/icons';
import {
  FORMAT_TEXT_COMMAND,
  INDENT_CONTENT_COMMAND,
  OUTDENT_CONTENT_COMMAND,
  type LexicalEditor,
} from 'lexical';
import type { ListType } from '@lexical/list';
import { $removeLineList, $setLineListType } from './lineList';
import type { Marks } from './useToolbarMarks';

/* Everything the toolbar can do, as a list. The component that renders it
   decides where the bar sits and nothing else, so adding or removing a control
   is an edit to this file alone. */
export type Control = {
  label: string;
  icon: ReactNode;
  isActive?: (marks: Marks) => boolean;
  press: (editor: LexicalEditor, marks: Marks) => void;
};

const bold: Control = {
  label: 'Bold',
  icon: <span className="rich-toolbar-glyph rich-toolbar-glyph-bold">B</span>,
  isActive: (marks) => marks.bold,
  press: (editor) => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold'),
};

const italic: Control = {
  label: 'Italic',
  icon: <span className="rich-toolbar-glyph rich-toolbar-glyph-italic">I</span>,
  isActive: (marks) => marks.italic,
  press: (editor) => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic'),
};

/* Toggles the caret's line, and only that line. Lexical's own INSERT_*_LIST
   and REMOVE_LIST are written for a document toolbar: the first takes the
   whole containing list, the second the whole top-level one at every depth.
   lineList.ts has the per-line versions and the reasoning. */
const listControl = (
  label: string,
  type: ListType,
  icon: ReactNode,
): Control => ({
  label,
  icon,
  isActive: (marks) => marks.list === type,
  press: (editor, marks) =>
    editor.update(() =>
      marks.list === type ? $removeLineList() : $setLineListType(type),
    ),
});

const numberedList = listControl(
  'Numbered list',
  'number',
  <IonIcon icon={listOutline} />,
);

const checklist = listControl(
  'Checklist',
  'check',
  <IonIcon icon={checkboxOutline} />,
);

/* Tab and Shift+Tab do this on a hardware keyboard, and no software keyboard
   has a Tab key — not iOS, not Gboard. On a phone these are the only way to
   nest a list at all, which is why they are here rather than being a nicety. */
const outdent: Control = {
  label: 'Outdent',
  icon: <IonIcon icon={chevronBack} />,
  press: (editor) => editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined),
};

const indent: Control = {
  label: 'Indent',
  icon: <IonIcon icon={chevronForward} />,
  press: (editor) => editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined),
};

/** Grouped as they are drawn: a divider goes between each pair of groups. */
export const TOOLBAR_GROUPS: Control[][] = [
  [bold, italic],
  [numberedList, checklist],
  [outdent, indent],
];
