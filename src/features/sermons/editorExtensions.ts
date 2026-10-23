import { Extension } from '@tiptap/core';
import { outlineInkAttributes } from './ink.ts';

export const ParagraphStyle = Extension.create({
  name: 'paragraphStyle',
  addGlobalAttributes() {
    return [{ types: ['paragraph', 'heading'], attributes: Object.fromEntries(['margin-left', 'text-indent', 'text-align'].map(property => [property, {
      default: null,
      parseHTML: (element: HTMLElement) => element.style.getPropertyValue(property) || null,
      renderHTML: (attributes: Record<string, string>) => attributes[property] ? { style: `${property}: ${attributes[property]}` } : {},
    }])) }];
  },
});
// TextStyle keeps the original color for round-tripping, while CSS supplies readable ink per theme.
export const ReadableInk = Extension.create({
  name: 'readableInk',
  addGlobalAttributes() {
    return [{ types: ['textStyle'], attributes: { readableInk: {
      default: true, parseHTML: () => true,
      renderHTML: (attributes: Record<string, string>) => outlineInkAttributes(attributes.color, attributes.backgroundColor),
    } } }];
  },
});
