import {
  $createParagraphNode,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isRootOrShadowRoot,
  type ElementNode,
} from 'lexical';
import {
  $createListItemNode,
  $createListNode,
  $isListItemNode,
  $isListNode,
  ListItemNode,
  ListNode,
  type ListType,
} from '@lexical/list';
import { $getNearestNodeOfType } from '@lexical/utils';

/* Lexical's own list commands are written for a document toolbar, where the
   unit of formatting is a block of selected text. Both are too broad for a
   per-line toggle:

   - $insertList takes the whole containing ListNode, moves every child into a
     new list of the target type and replaces it — so ticking one line turns
     all of its siblings into checkboxes too.
   - $removeList climbs to the *top* list with $getTopListNode and flattens
     every item at every depth into paragraphs — so unticking one line
     collapses the entire field into a run of loose lines.

   The thing that makes this awkward is that **a list type belongs to the list,
   not to the item**. One line cannot differ from its siblings while it shares
   their ListNode, so changing a single line means splitting the list around
   it. Everything here is built on that one operation. */

const $listItemAtCaret = (): ListItemNode | null => {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;

  return $getNearestNodeOfType<ListItemNode>(
    selection.anchor.getNode(),
    ListItemNode,
  );
};

/* An item that holds a list rather than text is the wrapper Lexical uses to
   nest one level inside another. Retyping or unwrapping it would move a whole
   subtree, which is never what pressing a button on one line means. */
const $holdsNestedList = (item: ListItemNode) =>
  item.getChildren().some((child) => $isListNode(child));

/* Nesting is a list inside a list *item*, and an item may hold only one list —
   so at depth the wrapper has to split alongside the list it holds, or two
   lists end up in one item and Lexical merges their text together. */
const $placeAfter = (list: ListNode, sibling: ListNode) => {
  const parent = list.getParentOrThrow();

  if ($isListItemNode(parent)) {
    const wrapper = $createListItemNode();
    wrapper.append(sibling);
    parent.insertAfter(wrapper);
    return;
  }

  list.insertAfter(sibling);
};

const $discard = (list: ListNode) => {
  const parent = list.getParent();
  list.remove();

  if ($isListItemNode(parent) && parent.getChildrenSize() === 0) {
    parent.remove();
  }
};

/* Splits the item's list so the item ends up alone in a list of its own, with
   whatever came before and after left in lists of the original type. Returns
   that new single-item list. */
const $isolate = (item: ListItemNode, type: ListType): ListNode => {
  const list = item.getParentOrThrow();
  if (!$isListNode(list)) throw new Error('list item outside a list');

  // Captured before anything moves, or the walk follows the node we detach.
  const after = item.getNextSiblings();
  const before = item.getPreviousSiblings();

  const own = $createListNode(type);
  own.append(item);

  if (after.length > 0) {
    const tail = $createListNode(list.getListType());
    for (const sibling of after) tail.append(sibling);
    /* The remainder carries on counting as though the line taken out of the
       middle had never been numbered: 1. a / [ ] b / 2. c, not 1. a / [ ] b /
       1. c, which is where a fresh list would start.

       Only the siblings that actually draw a number count. A nesting wrapper
       is a sibling in the tree but shows nothing of its own, so counting it
       leaves a visible gap — 1. / a. b. / [ ] / 3. */
    const numberedBefore = before.filter(
      (sibling) => $isListItemNode(sibling) && !$holdsNestedList(sibling),
    ).length;
    tail.setStart(list.getStart() + numberedBefore);
    $placeAfter(list, tail);
  }

  $placeAfter(list, own);

  // The head is empty when the item was first; nothing should be left behind.
  if (before.length === 0) $discard(list);

  return own;
};

/* A line that is not in a list yet joins the list next to it when there is
   one of the same type, rather than starting its own. Without this, taking a
   line out of a list and putting it back leaves three lists where there was
   one, and the numbering restarts in the middle. */
const $listFor = (item: ListItemNode, block: ElementNode, type: ListType) => {
  const previous = block.getPreviousSibling();
  const next = block.getNextSibling();

  if ($isListNode(previous) && previous.getListType() === type) {
    previous.append(item);
    block.remove();

    // The line just closed a gap between two runs, so they are one run now.
    if ($isListNode(next) && next.getListType() === type) {
      for (const child of next.getChildren()) previous.append(child);
      next.remove();
    }
    return;
  }

  if ($isListNode(next) && next.getListType() === type) {
    const first = next.getFirstChild();
    if (first) first.insertBefore(item);
    else next.append(item);
    next.setStart(Math.max(1, next.getStart() - 1));
    block.remove();
    return;
  }

  const list = $createListNode(type);
  list.append(item);
  block.replace(list);
};

/** Makes the line at the caret a list of `type`, leaving its siblings alone. */
export const $setLineListType = (type: ListType) => {
  const item = $listItemAtCaret();

  /* Not in a list at all — a plain paragraph, or a line that was just taken
     out of one. Wrapping it is the other half of the toggle; without it the
     buttons look dead once a line has been unlisted. */
  if (!item) {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;

    const block = selection.anchor.getNode().getTopLevelElement();
    if (!$isElementNode(block) || $isListNode(block)) return;

    const line = $createListItemNode();
    for (const child of block.getChildren()) line.append(child);

    $listFor(line, block, type);
    if (type === 'check') line.setChecked(false);
    line.selectEnd();
    return;
  }

  if ($holdsNestedList(item)) return;

  const list = item.getParentOrThrow();
  if ($isListNode(list) && list.getListType() === type) return;

  $isolate(item, type);

  // Ticked state lives on the item and only means anything inside a check
  // list, so it is set arriving and cleared leaving. A line promoted out of a
  // numbered list has none to keep and starts unticked.
  item.setChecked(type === 'check' ? (item.getChecked() ?? false) : undefined);
};

/** Turns the line at the caret back into a paragraph, leaving its siblings. */
export const $removeLineList = () => {
  const item = $listItemAtCaret();
  if (!item || $holdsNestedList(item)) return;

  const list = item.getParentOrThrow();
  if (!$isListNode(list)) return;

  /* Only a top-level line. A paragraph cannot sit inside a list item, so
     unlisting a nested line means lifting it out — and putting it back in the
     right place means splitting every list above it too. Outdent first: the
     button is right there, and doing nothing is better than moving a line
     somewhere the user did not point at. */
  if (!$isRootOrShadowRoot(list.getParentOrThrow())) return;

  const own = $isolate(item, list.getListType());
  const paragraph = $createParagraphNode();
  for (const child of item.getChildren()) paragraph.append(child);

  own.replace(paragraph);
  paragraph.selectEnd();
};

/** Whether the caret sits on a line these can act on at all. */
export const $lineListType = (): ListType | null => {
  const item = $listItemAtCaret();
  if (!item) return null;

  const list = item.getParentOrThrow();
  return $isListNode(list) ? list.getListType() : null;
};

export const $canRetypeLine = () => {
  const item = $listItemAtCaret();
  return item !== null && !$holdsNestedList(item);
};
