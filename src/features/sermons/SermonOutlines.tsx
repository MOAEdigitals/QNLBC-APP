import React, { useEffect, useRef, useState } from 'react';
import { Plus, ArrowLeft, Copy, RefreshCw, Maximize2, Minimize2, Pencil, X, FileText, Search } from 'lucide-react';
import type { UserAccount } from '../../types';
import { formatDateStr, getNextSundayStr, getTodayStr } from '../../utils/dateUtils';
import { generateUUID } from '../../services/supabaseData';
import { filterSermons } from './model';
import type { SermonOutline, SermonInput } from './model';
import { loadSermons, saveSermon } from './data';

const field = 'w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-900 dark:text-white';
const action = 'min-h-11 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium flex items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800';
const primary = 'min-h-11 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50';

export default function SermonOutlines({ currentUser }: { currentUser: UserAccount | null }) {
  const [rows, setRows] = useState<SermonOutline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming');
  const [search, setSearch] = useState('');
  const [today, setToday] = useState(getTodayStr);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [copyMessage, setCopyMessage] = useState('');
  const [editor, setEditor] = useState<{ input: SermonInput; original?: SermonOutline; newId?: string } | null>(null);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const alive = useRef(false);
  const loadingLock = useRef(false);
  const dialog = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const isAdmin = currentUser?.role === 'admin';
  const canAdd = !!currentUser?.active && (isAdmin || !!currentUser?.permissions?.canAdd);
  const canEdit = (row: SermonOutline) => !!currentUser?.active && (isAdmin || (row.author_id === currentUser.id && !!currentUser.permissions?.canEdit));

  async function refresh() {
    if (loadingLock.current) return;
    loadingLock.current = true;
    setLoading(true);
    try {
      const result = await loadSermons();
      if (alive.current) { setRows(result); setReady(true); setError(''); }
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : 'Unable to load sermons.');
    } finally {
      loadingLock.current = false;
      if (alive.current) setLoading(false);
    }
  }
  useEffect(() => {
    alive.current = true;
    void refresh();
    const onFocus = () => { setToday(getTodayStr()); void refresh(); };
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(onFocus, 60000);
    return () => { alive.current = false; window.removeEventListener('focus', onFocus); window.clearInterval(timer); };
  }, []);

  function closeEditor() {
    if (saveLock.current || !editor) return;
    const initial = editor.original;
    const dirty = initial
      ? ['service_date', 'title', 'preacher', 'outline'].some(key => editor.input[key as keyof SermonInput] !== initial[key as keyof SermonInput])
      : !!editor.input.title || !!editor.input.outline;
    if (dirty && !window.confirm('Discard your unsaved changes?')) return;
    setEditor(null); setSaveError('');
  }
  useEffect(() => {
    if (!editor) return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector<HTMLInputElement>('input')?.focus();
    return () => { document.body.style.overflow = oldOverflow; previous?.focus(); };
  }, [!!editor]);
  useEffect(() => {
    if (!fullscreen) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', escape);
    return () => { document.body.style.overflow = oldOverflow; window.removeEventListener('keydown', escape); };
  }, [fullscreen]);

  function startNew() {
    setSaveError('');
    setEditor({ newId: generateUUID(), input: { service_date: getNextSundayStr(), title: '', preacher: currentUser?.displayName || currentUser?.name || currentUser?.username || '', outline: '', status: 'draft' } });
  }
  async function submit(status: SermonInput['status']) {
    if (!editor || !currentUser || saveLock.current) return;
    saveLock.current = true; setSaving(true); setSaveError('');
    try {
      const saved = await saveSermon({ ...editor.input, status }, currentUser.id, editor.original, editor.newId);
      if (!alive.current) return;
      setRows(previous => [...previous.filter(row => row.id !== saved.id), saved]);
      setSelectedId(saved.id); setEditor(null); setCopyMessage('');
    } catch (e) {
      if (alive.current) setSaveError(e instanceof Error ? e.message : 'Unable to save. Your text is still here.');
    } finally {
      saveLock.current = false;
      if (alive.current) setSaving(false);
    }
  }
  const selected = rows.find(row => row.id === selectedId);
  const visible = filterSermons(rows, filter, today, search);
  function update(key: keyof SermonInput, value: string) {
    setEditor(previous => previous ? { ...previous, input: { ...previous.input, [key]: value } } : previous);
  }
  async function copy() {
    if (!selected) return;
    try { await navigator.clipboard.writeText(selected.outline); setCopyMessage('Copied.'); }
    catch { setCopyMessage('Copy unavailable. Select the outline text and copy it.'); }
  }

  return <div className="space-y-4 text-slate-900 dark:text-white">
    {error && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-900 dark:text-amber-200">{error}<button type="button" onClick={() => void refresh()} className={`${action} mt-2`} disabled={loading}>Retry</button></div>}
    {selected ? <section className={fullscreen ? 'fixed inset-0 z-50 overflow-auto bg-white dark:bg-slate-950 p-4 sm:p-8' : 'space-y-4'}>
      <div className={fullscreen ? 'max-w-5xl mx-auto space-y-4' : 'space-y-4'}>
        <div className="flex flex-wrap gap-2 items-center">
          <button type="button" className={action} onClick={() => { setSelectedId(null); setFullscreen(false); setCopyMessage(''); }}><ArrowLeft className="w-4 h-4" />Back</button>
          <button type="button" className={action} onClick={() => void copy()}><Copy className="w-4 h-4" />Copy outline</button>
          {canEdit(selected) && !fullscreen && <button type="button" className={action} onClick={() => { setSaveError(''); setEditor({ original: selected, input: { service_date: selected.service_date, title: selected.title, preacher: selected.preacher, outline: selected.outline, status: selected.status } }); }}><Pencil className="w-4 h-4" />Edit</button>}
          <button type="button" className={action} aria-label={fullscreen ? 'Exit full screen' : 'Full screen'} onClick={() => setFullscreen(!fullscreen)}>{fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}</button>
          <div className="flex gap-1"><button type="button" className={action} aria-label="Decrease text size" disabled={fontSize <= 12} onClick={() => setFontSize(size => Math.max(12, size - 2))}>A−</button><button type="button" className={action} aria-label="Increase text size" disabled={fontSize >= 32} onClick={() => setFontSize(size => Math.min(32, size + 2))}>A+</button></div>
        </div>
        <div><h2 className="text-lg font-semibold break-words">{selected.title}</h2><p className="text-sm text-slate-500 dark:text-slate-400">{formatDateStr(selected.service_date)} · {selected.preacher}{selected.status === 'draft' ? ' · Draft' : ''}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Updated {new Date(selected.updated_at).toLocaleString()}</p></div>
        {copyMessage && <p role="status" className="text-sm">{copyMessage}</p>}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 overflow-x-auto">
          <pre className="font-mono whitespace-pre m-0 leading-relaxed select-text" style={{ fontSize, tabSize: 4 }}>{selected.outline}</pre>
        </div>
      </div>
    </section> : <>
      <div className="flex gap-2 items-center"><div className="flex flex-1 gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
        {(['upcoming', 'past'] as const).map(value => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`flex-1 min-h-11 rounded-lg text-sm font-semibold ${filter === value ? 'bg-white dark:bg-slate-900 shadow-sm' : 'text-slate-500'}`}>{value === 'upcoming' ? 'Upcoming' : 'Past'}</button>)}
      </div><button type="button" className={action} onClick={() => void refresh()} disabled={loading} aria-label="Refresh outlines"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button></div>
      <div className="relative"><Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" /><input type="search" aria-label="Search sermons" placeholder="Search sermons" className={`${field} pl-9`} value={search} onChange={event => setSearch(event.target.value)} /></div>
      {canAdd && <button type="button" disabled={!ready} className={`${primary} w-full flex justify-center items-center gap-2`} onClick={startNew}><Plus className="w-4 h-4" />Add outline</button>}
      {loading && !ready && <p role="status" className="text-sm text-slate-500">Loading outlines…</p>}
      {ready && visible.length === 0 && <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center text-slate-500"><FileText className="w-8 h-8 mx-auto mb-2" /><p>{search ? 'No matching sermons.' : filter === 'past' ? 'No past sermons yet.' : 'No upcoming sermons yet.'}</p></div>}
      {visible.map(row => <button key={row.id} type="button" onClick={() => { setSelectedId(row.id); setCopyMessage(''); }} className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 hover:border-indigo-400">
        <div className="flex justify-between gap-3"><h3 className="font-semibold break-words">{row.title}</h3>{row.status === 'draft' && <span className="text-xs text-amber-600 shrink-0">Draft</span>}</div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{formatDateStr(row.service_date)} · {row.preacher}</p>
      </button>)}
    </>}
    {editor && <div className="fixed inset-0 z-50 bg-black/50 p-3 sm:p-6 flex items-center justify-center" onMouseDown={event => { if (event.target === event.currentTarget) closeEditor(); }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="sermon-editor-title" className="w-full max-w-3xl max-h-[90dvh] overflow-auto rounded-2xl bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-4" onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); closeEditor(); }
        if (event.key === 'Tab' && event.target !== textarea.current) {
          const controls = Array.from(dialog.current?.querySelectorAll('button:not(:disabled), input, textarea') || []) as HTMLElement[];
          const first = controls[0], last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
        <div className="flex justify-between items-center"><h2 id="sermon-editor-title" className="font-semibold">{editor.original ? 'Edit outline' : 'Add outline'}</h2><button type="button" disabled={saving} aria-label="Close editor" className={action} onClick={closeEditor}><X className="w-4 h-4" /></button></div>
        <form onSubmit={event => { event.preventDefault(); void submit('published'); }} className="space-y-4">
          <fieldset disabled={saving} className="space-y-4">
            <label className="block text-sm">Service date<input required type="date" className={`${field} mt-1`} value={editor.input.service_date} onChange={event => update('service_date', event.target.value)} /></label>
            <label className="block text-sm">Sermon title<input required className={`${field} mt-1`} value={editor.input.title} onChange={event => update('title', event.target.value)} /></label>
            <label className="block text-sm">Preacher<input required className={`${field} mt-1`} value={editor.input.preacher} onChange={event => update('preacher', event.target.value)} /></label>
            <label className="block text-sm">Outline<textarea ref={textarea} required rows={16} spellCheck={false} autoCorrect="off" autoCapitalize="off" wrap="off" className={`${field} mt-1 font-mono whitespace-pre overflow-x-auto`} style={{ tabSize: 4 }} value={editor.input.outline} onChange={event => update('outline', event.target.value)} onKeyDown={event => {
              if (event.key === 'Tab' && !event.shiftKey) {
                event.preventDefault(); const target = event.currentTarget; const start = target.selectionStart; const end = target.selectionEnd;
                update('outline', target.value.slice(0, start) + '\t' + target.value.slice(end));
                requestAnimationFrame(() => target.setSelectionRange(start + 1, start + 1));
              }
            }} /></label>
            <p className="text-xs text-slate-500">Spaces, tabs, bullets, asterisks, and line breaks are kept. Tab inserts an indent; Shift+Tab moves to the previous field.</p>
          </fieldset>
          {saveError && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{saveError}</p>}
          <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={saving} className={action} onClick={closeEditor}>Cancel</button><button type="button" disabled={saving} className={action} onClick={() => void submit('draft')}>{editor.original?.status === 'published' ? 'Make draft' : 'Save draft'}</button><button type="submit" disabled={saving} className={primary}>{saving ? 'Saving…' : editor.original?.status === 'published' ? 'Save & publish' : 'Publish'}</button></div>
          <p className="text-xs text-slate-500">Drafts are visible to you and admins. Published outlines are visible to everyone in the app.</p>
        </form>
      </div>
    </div>}
  </div>;
}
