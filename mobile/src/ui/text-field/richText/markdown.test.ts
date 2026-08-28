import { describe, expect, it } from 'vitest';
import { fromMarkdown, toMarkdown } from './markdown';

const roundTrip = (markdown: string) => toMarkdown(fromMarkdown(markdown));

const firstBlock = (markdown: string) => fromMarkdown(markdown).content?.[0];
const firstType = (markdown: string) => firstBlock(markdown)?.type ?? null;

describe('markdown in and out of the TipTap document', () => {
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

  // The ordering guard: a check list's marker starts with the same bullet an
  // unordered list uses, so a mis-read yields a bullet whose text is "[ ] todo"
  // — which serialises to the very same markdown. Only the node type tells them
  // apart, so the assertion has to read the tree.
  it('parses a checklist as a task list, not a bullet', () => {
    expect(firstType('- [ ] todo')).toBe('taskList');
    expect(firstType('- plain')).toBe('bulletList');
    expect(firstType('1. numbered')).toBe('orderedList');
    expect(firstType('just words')).toBe('paragraph');
  });

  it('keeps a list that does not start at one', () => {
    expect(roundTrip('3. three\n4. four')).toBe('3. three\n4. four');
  });

  it('round-trips bold and italic, together and apart', () => {
    expect(roundTrip('**bold** and *italic*')).toBe('**bold** and *italic*');
    expect(roundTrip('***both***')).toBe('***both***');
  });

  it('normalises underscore emphasis onto the star it writes', () => {
    expect(roundTrip('__bold__ and _italic_')).toBe('**bold** and *italic*');
  });

  it('round-trips a link, and one carrying emphasis', () => {
    expect(roundTrip('[docs](https://example.com)')).toBe(
      '[docs](https://example.com)',
    );
    expect(roundTrip('[**bold link**](https://example.com)')).toBe(
      '[**bold link**](https://example.com)',
    );
  });

  it('keeps plain paragraphs', () => {
    expect(roundTrip('one\n\ntwo')).toBe('one\n\ntwo');
  });

  it('is an empty paragraph for empty input', () => {
    expect(roundTrip('')).toBe('');
    expect(fromMarkdown('').content).toEqual([{ type: 'paragraph' }]);
  });

  it('does not let unsupported syntax become formatting', () => {
    expect(firstType('# heading')).toBe('paragraph');
    expect(roundTrip('# heading')).toBe('# heading');
    // No code node exists, so backticks are ordinary characters and need no
    // escape: nothing could promote them into formatting on the way back in.
    expect(roundTrip('`code`')).toBe('`code`');
  });
});

/* What a field holds is whatever it last exported, and reopening it is an
   import of exactly that. So the property that matters is not `export(x) === x`
   for arbitrary x — it is that a value stops changing once it has been through
   the editor. */
describe('surviving a save and a reopen', () => {
  const reopen = (markdown: string) => roundTrip(roundTrip(markdown));

  it('leaves its own output untouched', () => {
    for (const written of [
      '1. one\n2. two',
      '1. one\n    1. deep\n2. two',
      '- [x] done\n- [ ] todo',
      '**bold** and *italic*',
      '- one\n- two',
      '[docs](https://example.com)',
      'a \\* b',
    ]) {
      expect(roundTrip(written)).toBe(written);
      expect(reopen(written)).toBe(written);
    }
  });

  it('normalises foreign markdown once, then holds still', () => {
    // Bullet markers converge on "-", loose lines become their own paragraphs,
    // and a bare asterisk is escaped so it cannot later read as emphasis.
    const cases: [string, string][] = [
      ['* one\n* two', '- one\n- two'],
      ['+ one\n+ two', '- one\n- two'],
      ['__b__ and _i_', '**b** and *i*'],
      ['one\ntwo', 'one\n\ntwo'],
      ['a * b', 'a \\* b'],
      // Two spaces is not deep enough to nest; it flattens to a sibling.
      ['1. one\n  1. deep', '1. one\n2. deep'],
    ];

    for (const [foreign, settled] of cases) {
      expect(roundTrip(foreign)).toBe(settled);
      expect(reopen(foreign)).toBe(settled);
    }
  });
});
