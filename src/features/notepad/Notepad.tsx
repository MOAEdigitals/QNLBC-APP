import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Plus, Search, X, Trash2, RotateCcw, NotebookPen } from 'lucide-react';
import { useBackLayer } from '../../hooks/useBackLayer';
import { loadNotes, saveNote, setNoteDeleted, type PersonalNote } from './data';
const button = 'min-h-11 min-w-11 rounded-xl px-3 flex items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50';
interface Editor { id: string; title: string; body: string; original?: PersonalNote }
export default function Notepad({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [notes, setNotes] = useState<PersonalNote[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busy, setBusy] = useState(false), [trash, setTrash] = useState(false);
  const [query, setQuery] = useState(''), [searchOpen, setSearchOpen] = useState(false);
  const lock = useRef(false), live = useRef(false), closeButton = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  async function refresh() {
    setLoading(true);
    try { const rows = await loadNotes(userId); if (live.current) { setNotes(rows); setError(''); } }
    catch (e) { if (live.current) setError((e as Error).message); }
    finally { if (live.current) setLoading(false); }
  }
  useEffect(() => {
    live.current = true; void refresh(); closeButton.current?.focus();
    const before = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const focus = () => { if (!lock.current) void refresh(); };
    window.addEventListener('focus', focus);
    return () => { live.current = false; document.body.style.overflow = before; window.removeEventListener('focus', focus); };
  }, [userId]);
  function closeEditor() {
    if (lock.current || !editor) return;
    const dirty = editor.title !== (editor.original?.title || '') || editor.body !== (editor.original?.body || '');
    if (dirty && !window.confirm('Discard unsaved note changes?')) return;
    setEditor(null); setError('');
  }
  function closeSearch() { searchInput.current?.blur(); setQuery(''); setSearchOpen(false); }
  useBackLayer(true, () => { if (!lock.current) onClose(); });
  useBackLayer(!!editor, closeEditor);
  useBackLayer(!editor && (searchOpen || !!query), closeSearch);
  const update = (note: PersonalNote) => setNotes(rows => [note, ...rows.filter(row => row.id !== note.id)].sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
  async function save() {
    if (!editor || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { const note = await saveNote(userId, editor.id, editor.title, editor.body, editor.original); if (live.current) { update(note); setEditor(null); } }
    catch (e) { if (live.current) setError((e as Error).message); }
    finally { lock.current = false; if (live.current) setBusy(false); }
  }
  async function removeOrRestore(note: PersonalNote, deleted: boolean) {
    if (lock.current || (deleted && !window.confirm('Move this note to Recently deleted?'))) return;
    lock.current = true; setBusy(true); setError('');
    try { const saved = await setNoteDeleted(note, deleted); if (live.current) { update(saved); setEditor(null); } }
    catch (e) { if (live.current) setError((e as Error).message); }
    finally { lock.current = false; if (live.current) setBusy(false); }
  }
  const visible = notes.filter(note => !!note.deleted_at === trash && `${note.title}\n${note.body}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section role="dialog" aria-modal="true" aria-label="Notepad" data-no-swipe className="ui-viewport-screen fixed inset-0 z-[180] flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100" onKeyDown={e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (editor) closeEditor(); else if (searchOpen || query) closeSearch(); else if (!lock.current) onClose(); }
    if (e.key === 'Tab') {
      const controls = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea')).filter(x => x.offsetParent !== null);
      const first = controls[0], last = controls.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  }}>
    <header className="shrink-0 border-b border-slate-200 dark:border-slate-800 pt-[var(--app-safe-top)]"><div className="max-w-4xl mx-auto flex items-center gap-2 px-3 py-2">
      <button ref={closeButton} className={button} aria-label={editor ? 'Back to notes' : 'Close notepad'} disabled={busy} onClick={() => editor ? closeEditor() : onClose()}><ArrowLeft className="w-5 h-5" /></button>
      <h2 className="text-lg font-semibold flex-1">{editor ? 'Edit note' : trash ? 'Recently deleted' : 'Notepad'}</h2>
      {editor ? <><button className={button} disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</button>{editor.original && <button className={button} aria-label="Delete note" disabled={busy} onClick={() => void removeOrRestore(editor.original!, true)}><Trash2 className="w-5 h-5" /></button>}</> : <>
        <button className={button} aria-label="Search notes" onClick={() => { setSearchOpen(true); requestAnimationFrame(() => searchInput.current?.focus()); }}><Search className="w-5 h-5" /></button>
        <button className={button} aria-label={trash ? 'Show notes' : 'Recently deleted'} onClick={() => { closeSearch(); setTrash(value => !value); }}><NotebookPen className="w-5 h-5" /></button>
      </>}
    </div></header>
    {error && <p role="alert" className="max-w-4xl mx-auto w-full p-3 text-sm text-rose-600">{error}{!editor && <button className="ml-3 underline" onClick={() => void refresh()}>Retry</button>}</p>}
    {editor ? <div className="max-w-4xl mx-auto w-full flex-1 min-h-0 flex flex-col px-4 pb-[var(--app-safe-bottom)]">
      <input aria-label="Note title" maxLength={200} disabled={busy} value={editor.title} onChange={e => setEditor(previous => previous ? { ...previous, title: e.target.value } : previous)} placeholder="Title" className="w-full shrink-0 bg-transparent text-xl font-semibold py-4 outline-none" />
      <textarea aria-label="Note text" maxLength={200000} disabled={busy} value={editor.body} onChange={e => setEditor(previous => previous ? { ...previous, body: e.target.value } : previous)} placeholder="Write your note…" className="flex-1 min-h-0 w-full resize-none bg-transparent text-lg leading-relaxed outline-none pb-6" />
    </div> : <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-28"><div className="max-w-4xl mx-auto">
      {searchOpen && <div className="flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-3 my-3"><input ref={searchInput} type="search" aria-label="Find notes" value={query} onChange={e => setQuery(e.target.value)} className="flex-1 min-w-0 bg-transparent min-h-11 outline-none" placeholder="Search notes" /><button className={button} aria-label="Close note search" onClick={closeSearch}><X className="w-4 h-4" /></button></div>}
      {loading && <p role="status" className="py-4 text-sm text-slate-500">Loading notes…</p>}
      {!loading && !visible.length && <p className="py-12 text-center text-slate-500">{query ? 'No matching notes.' : trash ? 'No deleted notes.' : 'No notes yet. Tap + to create one.'}</p>}
      <div className="grid gap-3 sm:grid-cols-2 py-3">{visible.map(note => <article key={note.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
        {trash ? <><h3 className="font-semibold break-words">{note.title}</h3><p className="whitespace-pre-wrap line-clamp-3 text-sm mt-2">{note.body}</p><button className={`${button} mt-2`} disabled={busy} onClick={() => void removeOrRestore(note, false)}><RotateCcw className="w-4 h-4" />Restore</button></> : <button className="w-full text-left" onClick={() => { setError(''); setEditor({ id: note.id, title: note.title, body: note.body, original: note }); }}><h3 className="font-semibold break-words">{note.title}</h3><p className="whitespace-pre-wrap line-clamp-4 text-sm mt-2 text-slate-500 dark:text-slate-400 break-words">{note.body}</p></button>}
      </article>)}</div>
    </div></div>}
    {!editor && !trash && <button aria-label="Add note" onClick={() => { setError(''); setEditor({ id: crypto.randomUUID(), title: '', body: '' }); }} className="absolute right-4 bottom-[calc(1.5rem+var(--app-safe-bottom))] w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg"><Plus className="w-6 h-6" /></button>}
  </section>;
}
