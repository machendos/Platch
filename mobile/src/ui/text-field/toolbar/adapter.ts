/** The three list kinds the field can hold. Named here rather than imported
    from an editor package, because both bodies have to agree on them. */
export type ListType = 'number' | 'bullet' | 'check';

/** What the caret is currently sitting in, as the toolbar needs to show it. */
export type Marks = {
  bold: boolean;
  italic: boolean;
  list: ListType | null;
};

export const NO_MARKS: Marks = { bold: false, italic: false, list: null };

/* Everything the toolbar asks of an editor, and nothing else. There is one
   implementation today; the seam is kept because it is what lets the toolbar —
   its controls, its marks, and the placement work in RichTextToolbar.css —
   import no editor package at all. Swapping the editor underneath was done
   once already and cost nothing above this line.

   `subscribe` is deliberately vague: the bar only needs "something moved, read
   me again", not the shape of whatever the editor calls a change. */
export type EditorAdapter = {
  focus: () => void;
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleList: (type: ListType) => void;
  indent: () => void;
  outdent: () => void;
  readMarks: () => Marks;
  subscribe: (listener: () => void) => () => void;
};
