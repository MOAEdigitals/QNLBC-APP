import type { Editor } from '@tiptap/core';
import { closeHistory } from '@tiptap/pm/history';
import { bibleReferences, outlineLineStyle, isVerseLine } from './autoFormat.ts';

/** One undoable formatting pass. Never replace or reorder document content. */
export function formatOutlineEditor(editor: Editor) {
    const { state, view } = editor;
    const transaction = closeHistory(state.tr);
    const bold = state.schema.marks.bold;
    const textStyle = state.schema.marks.textStyle;
    let first = true;
    let verseBlock = false;
    function styleRange(from: number, to: number, attrs: Record<string, string>) {
      state.doc.nodesBetween(from, to, (node, position) => {
        if (!node.isText) return;
        const previous = node.marks.find(mark => mark.type === textStyle)?.attrs || {};
        transaction.addMark(Math.max(from, position), Math.min(to, position + node.nodeSize), textStyle.create({ ...previous, ...attrs }));
      });
    }
    state.doc.descendants((node, position) => {
      if (!node.isTextblock || node.type.name === 'codeBlock') return;
      const resolved = state.doc.resolve(position);
      const inList = Array.from({ length: resolved.depth }, (_, i) => resolved.node(i + 1).type.name).includes('listItem');
      const lines = node.textBetween(0, node.content.size, '\n', '\n').split('\n');
      let offset = position + 1;
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        const from = offset, to = offset + line.length;
        if (trimmed) {
          const kind = outlineLineStyle(line, first, inList && index === 0);
          if (kind) transaction.addMark(from, to, bold.create());
          if (kind === 'title') styleRange(from, to, { fontSize: '1.4em' });
          verseBlock = isVerseLine(line, verseBlock);
          if (verseBlock) styleRange(from, to, { color: '#197aa3' });
          bibleReferences(line).forEach(reference => {
            const start = from + reference.from, end = from + reference.to;
            transaction.addMark(start, end, bold.create());
            styleRange(start, end, { color: '#197aa3' });
          });
          first = false;
        } else verseBlock = false;
        offset = to + 1;
      });
    });
    if (transaction.docChanged) view.dispatch(transaction);
    editor.commands.focus();
}
