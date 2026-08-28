import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import { richTextExtensions } from './extensions';

const make = (content: string) => {
  const element = document.createElement('div');
  document.body.appendChild(element);
  return new Editor({ element, extensions: richTextExtensions(), content });
};

const markerClasses = (editor: Editor) =>
  [...editor.view.dom.querySelectorAll('li')].map((li) =>
    [...li.classList].filter((c) => c.startsWith('field-listitem-')).join(' '),
  );

describe('marker formatting', () => {
  it('marks a fully bold line and leaves a partly bold one alone', () => {
    const editor = make(
      '<ol>' +
        '<li><p><strong>all bold</strong></p></li>' +
        '<li><p>plain <strong>bold</strong></p></li>' +
        '<li><p>plain</p></li>' +
        '<li><p><em>all italic</em></p></li>' +
        '</ol>',
    );
    expect(markerClasses(editor)).toEqual([
      'field-listitem-bold',
      '',
      '',
      'field-listitem-italic',
    ]);
  });

  it('follows Enter then typing, which is where the CSS version failed', () => {
    const editor = make('<ol><li><p><strong>Bold line</strong></p></li></ol>');
    editor.commands.focus('end');
    editor.chain().splitListItem('listItem').run();
    expect(markerClasses(editor)).toEqual(['field-listitem-bold', '']);

    editor.commands.insertContent('next');
    expect(markerClasses(editor)).toEqual([
      'field-listitem-bold',
      'field-listitem-bold',
    ]);
  });
});
