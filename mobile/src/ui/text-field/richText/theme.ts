import type { EditorThemeClasses } from 'lexical';

export const richTextTheme: EditorThemeClasses = {
  list: {
    listitem: 'field-listitem',
    listitemChecked: 'field-listitem-checked',
    listitemUnchecked: 'field-listitem-unchecked',
    nested: { listitem: 'field-listitem-nested' },
    ol: 'field-list-ol',
    olDepth: ['field-list-ol-1', 'field-list-ol-2', 'field-list-ol-3'],
    ul: 'field-list-ul',
  },
  paragraph: 'field-paragraph',
  text: {
    bold: 'field-bold',
    italic: 'field-italic',
  },
};
