import { ListItemNode, ListNode } from '@lexical/list';
import type { Klass, LexicalNode } from 'lexical';

/* Only what the pinned transformers can produce. Bold and italic are text
   formats and need no node of their own, and registering nodes the markdown
   set cannot write would let a paste introduce content the field is unable to
   store. */
export const RICH_TEXT_NODES: Klass<LexicalNode>[] = [ListNode, ListItemNode];
