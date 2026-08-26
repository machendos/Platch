import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  BOLD_ITALIC_STAR,
  BOLD_ITALIC_UNDERSCORE,
  BOLD_STAR,
  BOLD_UNDERSCORE,
  CHECK_LIST,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  ORDERED_LIST,
  UNORDERED_LIST,
  type Transformer,
} from '@lexical/markdown';

/* Pinned, not @lexical/markdown's own TRANSFORMERS. That set grows with the
   library, so an upgrade could start writing headings, code fences or links
   into a field whose stored string nothing else knows how to render.

   CHECK_LIST must come before UNORDERED_LIST. Its pattern begins with the same
   bullet the unordered one matches, so with the order reversed `- [ ] buy
   milk` parses as a plain bullet whose text starts "[ ]". Lexical leaves
   CHECK_LIST out of ELEMENT_TRANSFORMERS rather than ordering it for us. */
export const RICH_TEXT_TRANSFORMERS: Transformer[] = [
  CHECK_LIST,
  ORDERED_LIST,
  UNORDERED_LIST,
  BOLD_ITALIC_STAR,
  BOLD_ITALIC_UNDERSCORE,
  BOLD_STAR,
  BOLD_UNDERSCORE,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
];

export const $readMarkdown = () =>
  $convertToMarkdownString(RICH_TEXT_TRANSFORMERS);

export const $writeMarkdown = (markdown: string) =>
  $convertFromMarkdownString(markdown, RICH_TEXT_TRANSFORMERS);
