import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<html><body></body></html>');
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Node: dom.window.Node, getComputedStyle: dom.window.getComputedStyle, requestAnimationFrame: () => 0 });
const { Editor } = await import('@tiptap/core');
const { default: StarterKit } = await import('@tiptap/starter-kit');
const { TextStyleKit } = await import('@tiptap/extension-text-style');
const { formatOutlineEditor } = await import('../src/features/sermons/formatEditor.ts');

test('magic formatting preserves the document, is stable on repeat, colors full verses and is undoable', () => {
  const editor = new Editor({ extensions: [StarterKit.configure({ trailingNode: false }), TextStyleKit], content: '<p>The gift of grace</p><p>John 3:16 For God so loved the world.</p><p>17 For God sent his Son.</p><p></p><p>Explanation stays regular.</p><ul><li><p>Application</p></li></ul>' });
  try {
    const original = editor.getHTML(), text = editor.getText();
    formatOutlineEditor(editor);
    const once = editor.getHTML();
    assert.equal(editor.getText(), text);
    assert.match(once, /font-size: 1.4em/);
    const root = document.createElement('div'); root.innerHTML = once;
    for (const index of [1, 2]) assert.ok(root.querySelectorAll('p')[index].querySelector('span[style*="color"]'), 'verse and continuation get consistent ink');
    assert.equal(root.querySelectorAll('p')[4].querySelector('[style*="color"]'), null);
    assert.equal(root.querySelectorAll('ul li').length, 1);
    formatOutlineEditor(editor); assert.equal(editor.getHTML(), once);
    editor.commands.undo(); assert.equal(editor.getHTML(), original);
    editor.commands.redo(); assert.equal(editor.getHTML(), once);
  } finally { editor.destroy(); }
});
