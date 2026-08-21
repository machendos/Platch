import { describe, expect, it } from 'vitest';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  createEditor,
} from 'lexical';
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

/* What a field holds is whatever it last exported, and reopening it is an
   import of exactly that. So the property that matters is not `export(x) === x`
   for arbitrary x — it is that a value stops changing once it has been through
   the editor. Anything that normalises does so on the first save and never
   drifts again, which is why a project cannot slowly rewrite itself across
   openings. */
describe('surviving a save and a reopen', () => {
  const reopen = (markdown: string) => roundTrip(roundTrip(markdown));

  const settles = (markdown: string) =>
    expect(reopen(markdown)).toBe(roundTrip(markdown));

  it('leaves its own output untouched', () => {
    for (const written of [
      '1. one\n2. two',
      '1. one\n    1. deep\n2. two',
      '- [x] done\n- [ ] todo',
      '**bold** and *italic*',
      '- one\n- two',
    ]) {
      expect(roundTrip(written)).toBe(written);
      expect(reopen(written)).toBe(written);
    }
  });

  it('keeps a bullet marker and a list that does not start at one', () => {
    expect(roundTrip('* one\n* two')).toBe('* one\n* two');
    expect(roundTrip('+ one\n+ two')).toBe('+ one\n+ two');
    expect(roundTrip('3. three\n4. four')).toBe('3. three\n4. four');
  });

  /* The one thing the format genuinely cannot carry. In the editor a list and
     a paragraph are different node types, so there is no ambiguity while you
     are typing — but markdown has no way to write "this paragraph merely
     begins with the characters 1.", and Lexical does not escape a leading list
     marker on export the way it escapes a backtick. So a paragraph that looks
     like a list is one after a reopen. Airtight would mean escaping on export
     or storing Lexical's JSON, and both cost more than this is worth today. */
  it('cannot tell a paragraph that looks like a list from a list', () => {
    const editor = createEditor({
      nodes: RICH_TEXT_NODES,
      onError: (error) => {
        throw error;
      },
    });
    editor.update(
      () => {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode('1. one'));
        root.append(paragraph);
      },
      { discrete: true },
    );

    let exported = '';
    editor.read(() => {
      exported = $readMarkdown();
    });

    expect(exported).toBe('1. one');
    expect(firstListType(exported)).toBe('number');
  });

  /* Markdown arriving from outside the editor — a paste, a hand-edited row —
     is normalised once. Each of these is stable from the second save on. */
  it('normalises foreign markdown once, then holds still', () => {
    expect(roundTrip('__b__ and _i_')).toBe('**b** and *i*');
    // Two spaces is not deep enough to nest; it flattens to a sibling.
    expect(roundTrip('1. one\n  1. deep')).toBe('1. one\n2. deep');

    for (const foreign of ['__b__ and _i_', '1. one\n  1. deep']) {
      settles(foreign);
    }
  });
});
