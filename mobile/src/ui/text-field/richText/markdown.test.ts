import { describe, expect, it } from 'vitest';
import { $getRoot, createEditor } from 'lexical';
import { $isListNode } from '@lexical/list';
import { $readMarkdown, $writeMarkdown } from './markdown';
import { RICH_TEXT_NODES } from './nodes';

// A headless editor is the honest way to test the transformer set: it is the
// same import/export path the field uses, without a DOM in the way.
const load = (markdown: string) => {
  const editor = createEditor({
    nodes: RICH_TEXT_NODES,
    onError: (error) => {
      throw error;
    },
  });
  editor.update(() => $writeMarkdown(markdown), { discrete: true });
  return editor;
};

const roundTrip = (markdown: string) => {
  let out = '';
  load(markdown).read(() => {
    out = $readMarkdown();
  });
  return out;
};

const firstListType = (markdown: string) => {
  let type: string | null = null;
  load(markdown).read(() => {
    const first = $getRoot().getFirstChild();
    type = $isListNode(first) ? first.getListType() : null;
  });
  return type;
};

describe('the pinned markdown transformers', () => {
  it('round-trips an ordered list', () => {
    expect(roundTrip('1. first\n2. second')).toBe('1. first\n2. second');
  });

  it('round-trips a nested ordered list', () => {
    const nested = '1. first\n    1. nested\n2. second';
    expect(roundTrip(nested)).toBe(nested);
  });

  it('round-trips a checklist, unchecked and checked', () => {
    expect(roundTrip('- [ ] todo\n- [x] done')).toBe('- [ ] todo\n- [x] done');
  });

  // The ordering guard, and it has to read the tree rather than the string:
  // CHECK_LIST's pattern starts with the same bullet UNORDERED_LIST matches, so
  // a mis-parse yields a plain bullet whose *text* is "[ ] todo" — which
  // exports to the very same markdown. Only the node type tells them apart.
  it('parses a checklist as a check list, not a bullet', () => {
    expect(firstListType('- [ ] todo')).toBe('check');
    expect(firstListType('- plain')).toBe('bullet');
    expect(firstListType('1. numbered')).toBe('number');
  });

  it('round-trips bold and italic', () => {
    expect(roundTrip('**bold** and *italic*')).toBe('**bold** and *italic*');
  });

  it('normalises underscore emphasis onto the star it writes', () => {
    expect(roundTrip('__bold__ and _italic_')).toBe('**bold** and *italic*');
  });

  it('keeps plain paragraphs', () => {
    expect(roundTrip('one\n\ntwo')).toBe('one\n\ntwo');
  });

  it('is empty for empty input', () => {
    expect(roundTrip('')).toBe('');
  });

  // Syntax outside the pinned set stays literal text. Backticks come back
  // escaped so a second import cannot promote them into code the field has no
  // node for; `#` needs no escape because no transformer would claim it.
  it('does not let unsupported syntax become formatting', () => {
    expect(firstListType('# heading')).toBeNull();
    expect(roundTrip('# heading')).toBe('# heading');
    expect(roundTrip('`code`')).toBe('\\`code\\`');
    expect(roundTrip('\\`code\\`')).toBe('\\`code\\`');
  });
});
