import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { Bold, Italic, List, ListOrdered, Undo2, Redo2 } from 'lucide-react';
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
export default function RichOutlineEditor({ html, text, disabled, onChange }: { html?: string | null; text: string; disabled: boolean; onChange: (html: string, text: string) => void }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: false }), TextStyleKit, ParagraphStyle],
    content: html ? sanitizeOutline(html) : plainTextHtml(text),
    parseOptions: { preserveWhitespace: 'full' },
    editable: !disabled,
    editorProps: {
      attributes: { class: 'sermon-prose min-h-[45vh] p-4 focus:outline-none', role: 'textbox', 'aria-label': 'Outline', 'aria-multiline': 'true', spellcheck: 'false' },
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
  const commands = [
    { label: 'Bold', icon: Bold, active: editor?.isActive('bold'), run: () => editor?.chain().focus().toggleBold().run() },
    { label: 'Italic', icon: Italic, active: editor?.isActive('italic'), run: () => editor?.chain().focus().toggleItalic().run() },
    { label: 'Bullets', icon: List, active: editor?.isActive('bulletList'), run: () => editor?.chain().focus().toggleBulletList().run() },
    { label: 'Numbered list', icon: ListOrdered, active: editor?.isActive('orderedList'), run: () => editor?.chain().focus().toggleOrderedList().run() },
    { label: 'Undo', icon: Undo2, run: () => editor?.chain().focus().undo().run() },
    { label: 'Redo', icon: Redo2, run: () => editor?.chain().focus().redo().run() },
  ];
  return <div className="rounded-xl border border-slate-300 dark:border-slate-600 overflow-hidden bg-white dark:bg-slate-900">
    <div className="flex flex-wrap gap-1 p-2 border-b border-slate-200 dark:border-slate-700">{commands.map(command => <button key={command.label} type="button" title={command.label} aria-label={command.label} aria-pressed={command.active} disabled={disabled} onClick={command.run} className={`w-10 h-10 rounded-lg flex items-center justify-center disabled:opacity-40 ${command.active ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}><command.icon className="w-4 h-4" /></button>)}</div>
    <EditorContent editor={editor} />
  </div>;
}
