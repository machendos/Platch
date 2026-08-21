import { describe, expect, it } from 'vitest';
import { $getRoot, createEditor, type LexicalEditor } from 'lexical';
import { $readMarkdown, $writeMarkdown } from './markdown';
import { RICH_TEXT_NODES } from './nodes';
import { $removeLineList, $setLineListType } from './lineList';

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

/* Puts the caret on the line whose text is `text`, wherever it sits, so the
   tests read as "with the caret on this line, press that button". */
const caretOn = (editor: LexicalEditor, text: string) => {
  editor.update(
    () => {
      const match = $getRoot()
        .getAllTextNodes()
        .find((node) => node.getTextContent() === text);
      if (!match) throw new Error(`no line reading ${text}`);
      match.select();
    },
    { discrete: true },
  );
};

const markdownOf = (editor: LexicalEditor) => {
  let out = '';
  editor.read(() => {
    out = $readMarkdown();
  });
  return out;
};

const act = (markdown: string, line: string, run: () => void) => {
  const editor = load(markdown);
  caretOn(editor, line);
  editor.update(run, { discrete: true });
  return markdownOf(editor);
};

describe('changing one line', () => {
  it('makes only the caret line a checkbox', () => {
    expect(act('1. a\n2. b\n3. c', 'b', () => $setLineListType('check'))).toBe(
      '1. a\n\n- [ ] b\n\n2. c',
    );
  });

  it('keeps the remainder counting rather than restarting it', () => {
    const out = act('1. a\n2. b\n3. c\n4. d', 'b', () =>
      $setLineListType('check'),
    );
    expect(out).toBe('1. a\n\n- [ ] b\n\n2. c\n3. d');
  });

  it('handles the first line', () => {
    expect(act('1. a\n2. b', 'a', () => $setLineListType('check'))).toBe(
      '- [ ] a\n\n1. b',
    );
  });

  it('handles the last line', () => {
    expect(act('1. a\n2. b', 'b', () => $setLineListType('check'))).toBe(
      '1. a\n\n- [ ] b',
    );
  });

  it('handles a list of one', () => {
    expect(act('1. only', 'only', () => $setLineListType('check'))).toBe(
      '- [ ] only',
    );
  });

  it('promotes a checkbox back to a number without touching its siblings', () => {
    expect(
      act('- [ ] a\n- [x] b\n- [ ] c', 'b', () => $setLineListType('number')),
    ).toBe('- [ ] a\n\n1. b\n\n- [ ] c');
  });

  it('does nothing when the line is already that type', () => {
    expect(act('1. a\n2. b', 'b', () => $setLineListType('number'))).toBe(
      '1. a\n2. b',
    );
  });
});

describe('removing the list from one line', () => {
  it('leaves the lines around it as lists', () => {
    expect(act('1. a\n2. b\n3. c', 'b', $removeLineList)).toBe(
      '1. a\n\nb\n\n2. c',
    );
  });

  it('does not flatten a checklist', () => {
    expect(act('- [ ] a\n- [x] b\n- [ ] c', 'b', $removeLineList)).toBe(
      '- [ ] a\n\nb\n\n- [ ] c',
    );
  });

  /* A paragraph cannot live inside a list item, so unlisting a nested line
     means lifting it out of every list above it and putting it back in the
     right place. Left undone deliberately: outdent first. Doing nothing is
     better than moving the line somewhere the user did not point at. */
  it('leaves a nested line alone', () => {
    const nested = '1. a\n    1. deep\n2. b';
    expect(act(nested, 'deep', $removeLineList)).toBe(nested);
  });
});

describe('nesting', () => {
  /* A nesting wrapper is a sibling in the tree that draws no number of its
     own, so counting it when renumbering the remainder leaves a visible gap. */
  it('does not count a nested block when the remainder keeps counting', () => {
    expect(
      act('1. a\n    1. deep\n2. b\n3. c', 'b', () =>
        $setLineListType('check'),
      ),
    ).toBe('1. a\n    1. deep\n\n- [ ] b\n\n2. c');
  });

  it('retypes a nested line in place, at its own depth', () => {
    expect(
      act('1. a\n    1. deep\n2. b', 'deep', () => $setLineListType('check')),
    ).toBe('1. a\n    - [ ] deep\n2. b');
  });

  it('leaves the siblings of a nested line alone', () => {
    expect(
      act('1. a\n    1. one\n    2. two\n2. b', 'one', () =>
        $setLineListType('check'),
      ),
    ).toBe('1. a\n    - [ ] one\n    1. two\n2. b');
  });
});
