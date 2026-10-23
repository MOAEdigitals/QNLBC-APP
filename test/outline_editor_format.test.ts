import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<html><body></body></html>');
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Node: dom.window.Node, getComputedStyle: dom.window.getComputedStyle, requestAnimationFrame: () => 0 });
const { Editor } = await import('@tiptap/core');
const { default: StarterKit } = await import('@tiptap/starter-kit');
const { TextStyleKit } = await import('@tiptap/extension-text-style');
const { formatOutlineEditor, alignOutlineParagraphs } = await import('../src/features/sermons/formatEditor.ts');

const { ParagraphStyle, ReadableInk } = await import('../src/features/sermons/editorExtensions.ts');

test('magic formatting preserves the document, is stable on repeat, colors full verses and is undoable', () => {
  const editor = new Editor({ extensions: [StarterKit.configure({ trailingNode: false }), TextStyleKit, ParagraphStyle, ReadableInk], content: '<p>The gift of grace</p><p>John 3:16 For God so loved the world.</p><p>17 For God sent his Son.</p><p></p><p>Explanation stays regular.</p><ul><li><p>Application</p></li></ul>' });
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


test('magic normalizes imported font families and sizes while preserving highlights, text and undo', () => {
  const editor = new Editor({ extensions: [StarterKit.configure({ trailingNode: false }), TextStyleKit, ParagraphStyle, ReadableInk], content: '<p><span style="font-family:Times New Roman;font-size:9px">Baptism</span></p><p><span style="font-family:Arial;font-size:32px;background-color:yellow;color:white">Meaning of baptism</span></p><p><span style="font-family:Courier New;font-size:27px">Romans 6:4 We are buried with him.</span></p>' });
  try {
    const original = editor.getHTML(), text = editor.getText();
    formatOutlineEditor(editor);
    const once = editor.getHTML();
    assert.equal(editor.getText(), text);
    assert.doesNotMatch(once, /font-family|9px|32px|27px/);
    assert.match(once, /font-size: 1.4em/);
    assert.match(once, /background-color: yellow/);
    formatOutlineEditor(editor); assert.equal(editor.getHTML(), once);
    editor.commands.undo(); assert.equal(editor.getHTML(), original);
  } finally { editor.destroy(); }
});


test('paragraph alignment covers selected paragraphs and headings, survives HTML round-trip, and supports undo', () => {
  const editor = new Editor({ extensions: [StarterKit.configure({ trailingNode: false }), TextStyleKit, ParagraphStyle], content: '<p>First paragraph</p><h2>A heading</h2><p>Last paragraph</p>' });
  try {
    const original = editor.getHTML(), text = editor.getText();
    editor.commands.selectAll();
    alignOutlineParagraphs(editor, 'center');
    const centered = editor.getHTML();
    const root = document.createElement('div'); root.innerHTML = centered;
    for (const block of root.querySelectorAll<HTMLElement>('p,h2')) assert.equal(block.style.textAlign, 'center');
    assert.equal(editor.getText(), text);
    editor.commands.undo(); assert.equal(editor.getHTML(), original);
    editor.commands.redo(); assert.equal(editor.getHTML(), centered);
    editor.commands.selectAll(); alignOutlineParagraphs(editor, 'justify');
    assert.match(editor.getHTML(), /text-align: justify/);
    editor.commands.setContent(editor.getHTML()); assert.match(editor.getHTML(), /text-align: justify/);
  } finally { editor.destroy(); }
});
