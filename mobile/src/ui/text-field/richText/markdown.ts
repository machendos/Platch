import type { JSONContent } from '@tiptap/react';

/* TipTap stores HTML or its own JSON; this field stores markdown, because that
   decision belongs to the database and not to the editor (docs/rich-text.md).
   So the conversion is ours.

   It is hand-written rather than taken from `tiptap-markdown` deliberately:
   that package is 0.9.0, one maintainer, and was last published in September
   2025 while TipTap itself shipped through 3.30 — an unmaintained dependency
   sitting directly on the persistence layer. The format here is only five
   features wide, which is small enough to own. */

const INDENT = '    ';

type Mark = { type: string; attrs?: Record<string, unknown> };

/* ===== markdown out ===== */

// Escaped on the way out so the parser cannot read them back as syntax. The
// parser undoes exactly this set, which is what makes the round trip settle.
const escapeText = (text: string) => text.replace(/([\\*_[\]])/g, '\\$1');

const wrap = (text: string, marks: Mark[] | undefined): string => {
  if (!marks?.length) return text;

  const has = (type: string) => marks.some((mark) => mark.type === type);
  let out = text;

  if (has('bold') && has('italic')) out = `***${out}***`;
  else if (has('bold')) out = `**${out}**`;
  else if (has('italic')) out = `*${out}*`;

  const link = marks.find((mark) => mark.type === 'link');
  if (link) out = `[${out}](${String(link.attrs?.href ?? '')})`;

  return out;
};

const inlineToMarkdown = (nodes: JSONContent[] | undefined): string =>
  (nodes ?? [])
    .map((node) =>
      node.type === 'text'
        ? wrap(escapeText(node.text ?? ''), node.marks as Mark[] | undefined)
        : '',
    )
    .join('');

const LIST_TYPES = new Set(['orderedList', 'bulletList', 'taskList']);

const markerFor = (list: JSONContent, index: number): string => {
  if (list.type === 'orderedList') {
    const start = Number(list.attrs?.start ?? 1);
    return `${start + index}. `;
  }
  return '- ';
};

const itemToMarkdown = (
  list: JSONContent,
  item: JSONContent,
  index: number,
  depth: number,
): string => {
  const children = item.content ?? [];
  // A list item holds a paragraph and optionally a nested list.
  const lead = children.find((child) => !LIST_TYPES.has(child.type ?? ''));
  const nested = children.filter((child) => LIST_TYPES.has(child.type ?? ''));

  const box =
    list.type === 'taskList' ? (item.attrs?.checked ? '[x] ' : '[ ] ') : '';

  const lines = [
    INDENT.repeat(depth) +
      markerFor(list, index) +
      box +
      inlineToMarkdown(lead?.content),
    ...nested.map((child) => listToMarkdown(child, depth + 1)),
  ];

  return lines.join('\n');
};

const listToMarkdown = (list: JSONContent, depth: number): string =>
  (list.content ?? [])
    .map((item, index) => itemToMarkdown(list, item, index, depth))
    .join('\n');

const blockToMarkdown = (node: JSONContent): string =>
  LIST_TYPES.has(node.type ?? '')
    ? listToMarkdown(node, 0)
    : inlineToMarkdown(node.content);

export const toMarkdown = (doc: JSONContent): string =>
  (doc.content ?? [])
    .map(blockToMarkdown)
    .filter((block) => block.length > 0)
    .join('\n\n');

/* ===== markdown in ===== */

type Kind = 'ordered' | 'bullet' | 'task' | 'text';

type Line = {
  indent: number;
  kind: Kind;
  text: string;
  checked: boolean;
  start: number;
};

const TASK = /^[-*+][ \t]+\[([ xX])\][ \t]*(.*)$/;
const ORDERED = /^(\d+)\.[ \t]+(.*)$/;
const BULLET = /^[-*+][ \t]+(.*)$/;

const readLine = (raw: string): Line | null => {
  if (!raw.trim()) return null;

  const indent = Math.floor((raw.length - raw.trimStart().length) / 4);
  const rest = raw.trimStart();

  const task = TASK.exec(rest);
  if (task)
    return {
      indent,
      kind: 'task',
      text: task[2],
      checked: task[1].toLowerCase() === 'x',
      start: 1,
    };

  const ordered = ORDERED.exec(rest);
  if (ordered)
    return {
      indent,
      kind: 'ordered',
      text: ordered[2],
      checked: false,
      start: Number(ordered[1]),
    };

  const bullet = BULLET.exec(rest);
  if (bullet)
    return {
      indent,
      kind: 'bullet',
      text: bullet[1],
      checked: false,
      start: 1,
    };

  return { indent, kind: 'text', text: rest, checked: false, start: 1 };
};

/* Ordered so the longest run wins: *** before **, ** before *. A lazy body
   (`+?`) keeps `*a* and *b*` from collapsing into one emphasis spanning both.

   Built fresh per call rather than kept as a module constant: parseInline
   recurses for a link's own text, and a shared /g regex would carry lastIndex
   into the recursion and back out again. */
const inlinePattern = () =>
  /\\([\s\S])|\*\*\*([\s\S]+?)\*\*\*|___([\s\S]+?)___|\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|\*([\s\S]+?)\*|_([\s\S]+?)_|\[([^\]]*)\]\(([^)]*)\)/g;

const text = (value: string, marks: Mark[]): JSONContent[] =>
  value
    ? [{ type: 'text', text: value, ...(marks.length ? { marks } : {}) }]
    : [];

const parseInline = (source: string, inherited: Mark[] = []): JSONContent[] => {
  const out: JSONContent[] = [];
  let plain = '';
  let last = 0;

  const pattern = inlinePattern();
  for (let m = pattern.exec(source); m; m = pattern.exec(source)) {
    plain += source.slice(last, m.index);

    const [
      ,
      escaped,
      bothStar,
      bothLow,
      boldStar,
      boldLow,
      itStar,
      itLow,
      linkText,
      href,
    ] = m;

    if (escaped !== undefined) {
      plain += escaped;
    } else {
      out.push(...text(plain, inherited));
      plain = '';

      const both = bothStar ?? bothLow;
      const bold = boldStar ?? boldLow;
      const italic = itStar ?? itLow;

      if (both !== undefined)
        out.push(
          ...text(both, [...inherited, { type: 'bold' }, { type: 'italic' }]),
        );
      else if (bold !== undefined)
        out.push(...text(bold, [...inherited, { type: 'bold' }]));
      else if (italic !== undefined)
        out.push(...text(italic, [...inherited, { type: 'italic' }]));
      else
        out.push(
          ...parseInline(linkText, [
            ...inherited,
            { type: 'link', attrs: { href } },
          ]),
        );
    }

    last = m.index + m[0].length;
  }

  plain += source.slice(last);
  out.push(...text(plain, inherited));
  return out;
};

const paragraph = (source: string): JSONContent => {
  const content = parseInline(source);
  return content.length
    ? { type: 'paragraph', content }
    : { type: 'paragraph' };
};

const LIST_NODE: Record<Exclude<Kind, 'text'>, string> = {
  ordered: 'orderedList',
  bullet: 'bulletList',
  task: 'taskList',
};

const parseBlocks = (
  lines: Line[],
  from: number,
  depth: number,
): [JSONContent[], number] => {
  const nodes: JSONContent[] = [];
  let i = from;

  while (i < lines.length && lines[i].indent >= depth) {
    if (lines[i].kind === 'text') {
      if (depth > 0) break;
      nodes.push(paragraph(lines[i].text));
      i += 1;
      continue;
    }

    const kind = lines[i].kind as Exclude<Kind, 'text'>;
    const start = lines[i].start;
    const items: JSONContent[] = [];
    // The level this run actually sits at, which need not be `depth`: markdown
    // lets the first item be over-indented, and keying off `depth` there would
    // match nothing and spin the outer loop forever.
    const level = lines[i].indent;

    while (
      i < lines.length &&
      lines[i].indent === level &&
      lines[i].kind === kind
    ) {
      const line = lines[i];
      i += 1;

      const children: JSONContent[] = [paragraph(line.text)];
      if (i < lines.length && lines[i].indent > level) {
        const [nested, next] = parseBlocks(lines, i, level + 1);
        children.push(...nested);
        i = next;
      }

      items.push(
        kind === 'task'
          ? {
              type: 'taskItem',
              attrs: { checked: line.checked },
              content: children,
            }
          : { type: 'listItem', content: children },
      );
    }

    nodes.push({
      type: LIST_NODE[kind],
      ...(kind === 'ordered' ? { attrs: { start } } : {}),
      content: items,
    });
  }

  return [nodes, i];
};

export const fromMarkdown = (markdown: string): JSONContent => {
  const lines = markdown
    .split('\n')
    .map(readLine)
    .filter((l): l is Line => !!l);
  const [content] = parseBlocks(lines, 0, 0);

  // ProseMirror will not accept an empty doc for a schema whose top node
  // requires a block, so an empty field is one empty paragraph.
  return {
    type: 'doc',
    content: content.length ? content : [{ type: 'paragraph' }],
  };
};
