import type { ReactNode } from 'react';
import { IonIcon } from '@ionic/react';
import {
  checkboxOutline,
  chevronBack,
  chevronForward,
  listOutline,
} from 'ionicons/icons';
import type { EditorAdapter, ListType, Marks } from './adapter';

/* Everything the toolbar can do, as a list. The component that renders it
   decides where the bar sits and nothing else, so adding or removing a control
   is an edit to this file alone. Controls speak to an EditorAdapter, never to
   an editor directly. */
export type Control = {
  label: string;
  icon: ReactNode;
  isActive?: (marks: Marks) => boolean;
  press: (editor: EditorAdapter) => void;
};

const bold: Control = {
  label: 'Bold',
  icon: <span className="rich-toolbar-glyph rich-toolbar-glyph-bold">B</span>,
  isActive: (marks) => marks.bold,
  press: (editor) => editor.toggleBold(),
};

const italic: Control = {
  label: 'Italic',
  icon: <span className="rich-toolbar-glyph rich-toolbar-glyph-italic">I</span>,
  isActive: (marks) => marks.italic,
  press: (editor) => editor.toggleItalic(),
};

/* Toggles the caret's line, and only that line — `toggleList` means "make this
   line this kind, or plain if it already is". */
const listControl = (
  label: string,
  type: ListType,
  icon: ReactNode,
): Control => ({
  label,
  icon,
  isActive: (marks) => marks.list === type,
  press: (editor) => editor.toggleList(type),
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
  press: (editor) => editor.outdent(),
};

const indent: Control = {
  label: 'Indent',
  icon: <IonIcon icon={chevronForward} />,
  press: (editor) => editor.indent(),
};

/** Grouped as they are drawn: a divider goes between each pair of groups. */
export const TOOLBAR_GROUPS: Control[][] = [
  [bold, italic],
  [numberedList, checklist],
  [outdent, indent],
];
