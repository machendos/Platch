import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNearestNodeFromDOMNode } from 'lexical';
import { $isListItemNode, $isListNode } from '@lexical/list';
import { isMarkerTap } from './checkListTap';

/* Replaces Lexical's CheckListPlugin, which is written for a document where
   the checkbox is a control in its own right. In a text field it fought the
   caret four ways at once, all of them from the same habit of moving DOM focus
   onto the <li role="checkbox">:

   - the toolbar vanished, because the editable had blurred;
   - space toggled the box instead of typing, because KEY_SPACE_COMMAND fires
     whenever a check item holds focus;
   - iOS offered its Paste / Select callout, because focus sat on a
     non-editable element;
   - and arrow keys moved focus to the marker rather than the text.

   This does one thing: if a click landed on the marker, toggle that item. It
   never touches focus, registers no key handlers, and leaves the caret to the
   browser — so tapping the box also puts the caret on that line, which is
   where the user just pointed. */
export const CheckListTapPlugin = () => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const item = target.closest('li');
      if (!item) return;

      const isCheckItem = editor.read(() => {
        const node = $getNearestNodeFromDOMNode(item);
        if (!$isListItemNode(node)) return false;

        const list = node.getParent();
        return $isListNode(list) && list.getListType() === 'check';
      });
      if (!isCheckItem) return;

      // The drawn marker, read from the same token that draws it, so the two
      // cannot drift.
      const markerWidth =
        parseFloat(
          getComputedStyle(item).getPropertyValue('--checkbox-size'),
        ) || 0;

      if (
        !isMarkerTap(event.clientX, item.getBoundingClientRect(), markerWidth)
      )
        return;

      editor.update(() => {
        const node = $getNearestNodeFromDOMNode(item);
        if ($isListItemNode(node)) node.setChecked(!node.getChecked());
      });
    };

    return editor.registerRootListener((root, previousRoot) => {
      previousRoot?.removeEventListener('click', onClick);
      root?.addEventListener('click', onClick);
    });
  }, [editor]);

  return null;
};
