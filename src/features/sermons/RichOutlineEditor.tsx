import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { Bold, Italic, List, ListOrdered, Undo2, Redo2, WandSparkles, Underline } from 'lucide-react';
import { formatOutlineEditor } from './formatEditor';
import { outlineInkAttributes } from './ink';
import { plainTextHtml, sanitizeOutline } from './formatting';

const ParagraphStyle = Extension.create({
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
const ReadableInk = Extension.create({
  name: 'readableInk',
  addGlobalAttributes() {
    return [{ types: ['textStyle'], attributes: { readableInk: {
      default: true, parseHTML: () => true,
      renderHTML: (attributes: Record<string, string>) => outlineInkAttributes(attributes.color),
    } } }];
  },
});
export default function RichOutlineEditor({ html, text, disabled, onChange }: { html?: string | null; text: string; disabled: boolean; onChange: (html: string, text: string) => void }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: false, trailingNode: false }), TextStyleKit, ParagraphStyle, ReadableInk],
    content: html ? sanitizeOutline(html) : plainTextHtml(text),
    // Preserve asterisk notation for the reader; toolbar formatting still works.
    enableInputRules: ['bulletList', 'orderedList', 'blockquote', 'heading', 'codeBlock', 'horizontalRule', 'strike', 'code'],
    enablePasteRules: ['strike', 'code'],
    parseOptions: { preserveWhitespace: 'full' },
    editable: !disabled,
    editorProps: {
      attributes: { class: 'sermon-prose min-h-[45vh] p-4 focus:outline-none', role: 'textbox', 'aria-label': 'Outline', 'aria-multiline': 'true', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'sentences', spellcheck: 'false', 'data-form-type': 'other', 'data-lpignore': 'true' },
      handlePaste(view, event) {
        const clipboard = event.clipboardData;
        if (!clipboard) return false;
        const rich = clipboard.getData('text/html');
        const plain = clipboard.getData('text/plain');
        if (!rich && !plain) return false;
        event.preventDefault();
        editor?.commands.insertContent(rich ? sanitizeOutline(rich) : plainTextHtml(plain), { parseOptions: { preserveWhitespace: 'full' } });
        return true;
      },
      handleKeyDown(view, event) {
        if (event.key === 'Tab' && !event.shiftKey) {
          event.preventDefault();
          if (editor?.isActive('listItem')) editor.commands.sinkListItem('listItem');
          else editor?.commands.insertContent('\t');
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => onChange(sanitizeOutline(editor.getHTML()), editor.getText({ blockSeparator: '\n' })),
  });
  useEffect(() => { editor?.setEditable(!disabled); }, [disabled, editor]);
  function formatOutline() {
    if (!editor || disabled) return;
    formatOutlineEditor(editor);
  }
  const commands = [
    { label: 'Bold', icon: Bold, active: editor?.isActive('bold'), run: () => editor?.chain().focus().toggleBold().run() },
    { label: 'Italic', icon: Italic, active: editor?.isActive('italic'), run: () => editor?.chain().focus().toggleItalic().run() },
    { label: 'Underline', icon: Underline, active: editor?.isActive('underline'), run: () => editor?.chain().focus().toggleUnderline().run() },
    { label: 'Bullets', icon: List, active: editor?.isActive('bulletList'), run: () => editor?.chain().focus().toggleBulletList().run() },
    { label: 'Numbered list', icon: ListOrdered, active: editor?.isActive('orderedList'), run: () => editor?.chain().focus().toggleOrderedList().run() },
    { label: 'Undo', icon: Undo2, run: () => editor?.chain().focus().undo().run() },
    { label: 'Redo', icon: Redo2, run: () => editor?.chain().focus().redo().run() },
    { label: 'Format outline', icon: WandSparkles, run: formatOutline },
  ];
  return <div className="rounded-xl border border-slate-300 dark:border-slate-600 overflow-hidden bg-white dark:bg-slate-900">
    <div role="toolbar" aria-label="Outline formatting" className="flex flex-wrap gap-0.5 sm:gap-1 p-2 border-b border-slate-200 dark:border-slate-700">
      <select aria-label="Paragraph style" disabled={disabled || !editor} value={editor?.isActive('heading', { level: 1 }) ? '1' : editor?.isActive('heading', { level: 2 }) ? '2' : editor?.isActive('heading', { level: 3 }) ? '3' : 'paragraph'} onChange={event => { const value = event.target.value; if (value === 'paragraph') editor?.chain().focus().setParagraph().run(); else editor?.chain().focus().setHeading({ level: Number(value) as 1 | 2 | 3 }).run(); }} className="h-10 max-w-32 rounded-lg bg-white dark:bg-slate-900 px-2 text-sm border border-slate-200 dark:border-slate-700"><option value="paragraph">Normal text</option><option value="1">Heading 1</option><option value="2">Heading 2</option><option value="3">Heading 3</option></select>
      {commands.map(command => <button key={command.label} type="button" title={command.label} aria-label={command.label} aria-pressed={command.active} disabled={disabled || !editor} onClick={command.run} className={`w-9 sm:w-10 h-10 shrink-0 rounded-lg flex items-center justify-center disabled:opacity-40 ${command.active ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}><command.icon className="w-4 h-4" /></button>)}</div>
    <EditorContent editor={editor} />
  </div>;
}
