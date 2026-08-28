import { Extension } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

/* A list marker is drawn by the browser from the <li> and inherits nothing
   from the text inside it, so a bold line kept an upright "1.".

   This cannot be done in CSS. `li:has(> p > strong:only-child)` looks like it
   says "the whole line is bold", but `:only-child` counts *elements* — bare
   text nodes are invisible to it — so `plain **bold**` matches too. There is no
   selector for "contains no unmarked text". The document knows, so ask it. */

const MARKER_MARKS = [
  { mark: 'bold', className: 'field-listitem-bold' },
  { mark: 'italic', className: 'field-listitem-italic' },
];

/** The item's own line — not any list nested inside it, which owns its own. */
const lineOf = (item: ProseMirrorNode) => {
  const first = item.firstChild;
  return first?.type.name === 'paragraph' ? first : null;
};

const wholeLineCarries = (item: ProseMirrorNode, mark: string) => {
  const line = lineOf(item);
  if (!line) return false;

  let sawText = false;
  let everywhere = true;

  line.descendants((child) => {
    if (!child.isText) return;
    sawText = true;
    if (!child.marks.some((m) => m.type.name === mark)) everywhere = false;
  });

  // An empty line carries nothing, which is why a marker is plain for the beat
  // between pressing Enter and typing the first character.
  return sawText && everywhere;
};

export const MarkerFormatting = Extension.create({
  name: 'markerFormatting',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('markerFormatting'),
        props: {
          decorations: (state) => {
            const decorations: Decoration[] = [];

            state.doc.descendants((node, pos) => {
              if (node.type.name !== 'listItem') return;

              const classes = MARKER_MARKS.filter(({ mark }) =>
                wholeLineCarries(node, mark),
              ).map(({ className }) => className);

              if (classes.length) {
                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    class: classes.join(' '),
                  }),
                );
              }
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
