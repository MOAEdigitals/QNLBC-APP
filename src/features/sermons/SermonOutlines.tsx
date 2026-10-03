import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Plus, ArrowLeft, Copy, Pencil, X, FileText, Search, Paperclip, Check, Minus } from 'lucide-react';
import type { UserAccount } from '../../types';
import { formatDateStr, getNextSundayStr, getTodayStr } from '../../utils/dateUtils';
import { generateUUID } from '../../services/supabaseData';
import { listSermons, sermonPayload } from './model';
import type { SermonOutline, SermonInput, SermonAttachment } from './model';
import { loadSermons, saveSermon } from './data';
import { uploadSermonFile, validateSermonFile, removeUnusedSermonFiles } from './attachments';
import { plainTextHtml, sanitizeOutline } from './formatting';
import RichOutlineEditor from './RichOutlineEditor';
const AttachmentViewer = lazy(() => import('./AttachmentViewer'));
const field = 'w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-900 dark:text-white';
const action = 'min-h-11 px-3 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40';
const primary = 'min-h-11 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50';
interface OutlineEditor { input: SermonInput; original?: SermonOutline; newId: string }
interface PendingFile { id: string; file: File }

export default function SermonOutlines({ currentUser }: { currentUser: UserAccount | null }) {
  const [rows, setRows] = useState<SermonOutline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState('');
  const [today, setToday] = useState(getTodayStr);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [source, setSource] = useState('outline');
  const [fontSize, setFontSize] = useState(19);
  const [copyMessage, setCopyMessage] = useState('');
  const [editor, setEditor] = useState<OutlineEditor | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [checkingFiles, setCheckingFiles] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState('Saving…');
  const saveLock = useRef(false);
  const alive = useRef(false);
  const loadingLock = useRef(false);
  const surface = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const isAdmin = currentUser?.role === 'admin';
  const canAdd = !!currentUser?.active && (isAdmin || !!currentUser?.permissions?.canAdd);
  const canEdit = (row: SermonOutline) => !!currentUser?.active && (isAdmin || (row.author_id === currentUser.id && !!currentUser.permissions?.canEdit));
  const selected = rows.find(row => row.id === selectedId);
  const visible = listSermons(rows, today, search);
  const attachments = selected?.attachments || [];
  const activeAttachment = attachments.find(item => item.id === source);
  const fullScreen = !!selected || !!editor;

  async function refresh() {
    if (loadingLock.current) return;
    loadingLock.current = true; setLoading(true);
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
    alive.current = true; void refresh();
    const onFocus = () => { setToday(getTodayStr()); void refresh(); };
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(onFocus, 60000);
    return () => { alive.current = false; window.removeEventListener('focus', onFocus); window.clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (!selected || editor) return;
    if (source === 'outline' && !selected.outline.trim() && attachments.length) setSource(attachments[0].id);
    else if (source !== 'outline' && !activeAttachment) setSource(selected.outline.trim() ? 'outline' : attachments[0]?.id || 'outline');
  }, [selected, source, editor]);
  useEffect(() => {
    if (!fullScreen) return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    surface.current?.focus();
    return () => { document.body.style.overflow = oldOverflow; previous?.focus(); };
  }, [fullScreen]);

  function openSermon(row: SermonOutline) {
    setSource(row.outline.trim() ? 'outline' : row.attachments?.[0]?.id || 'outline');
    setSelectedId(row.id); setCopyMessage('');
  }
  function closeReader() { setSelectedId(null); setCopyMessage(''); }
  function closeEditor() {
    if (saveLock.current || checkingFiles || !editor) return;
    const original = editor.original;
    const dirty = original
      ? ['service_date', 'title', 'preacher', 'outline', 'outline_html'].some(key => (editor.input[key as keyof SermonInput] || '') !== (original[key as keyof SermonInput] || ''))
        || JSON.stringify(editor.input.attachments || []) !== JSON.stringify(original.attachments || []) || pendingFiles.length > 0
      : !!editor.input.title || !!editor.input.preacher || !!editor.input.outline || !!editor.input.attachments?.length || pendingFiles.length > 0;
    if (dirty && !window.confirm('Discard your unsaved changes?')) return;
    const originalPaths = new Set(original?.attachments?.map(item => item.path));
    void removeUnusedSermonFiles((editor.input.attachments || []).filter(item => !originalPaths.has(item.path)).map(item => item.path));
    setEditor(null); setPendingFiles([]); setSaveError('');
  }
  function startNew() {
    setSaveError(''); setPendingFiles([]);
    setEditor({ newId: generateUUID(), input: { service_date: getNextSundayStr(), title: '', preacher: '', outline: '', outline_html: '', attachments: [], is_done: false, status: 'draft' } });
  }
  function startEdit(row: SermonOutline) {
    setSaveError(''); setPendingFiles([]);
    setEditor({ newId: row.id, original: row, input: { service_date: row.service_date, title: row.title, preacher: row.preacher, outline: row.outline, outline_html: row.outline_html, attachments: row.attachments || [], is_done: !!row.is_done, status: row.status } });
  }
  async function addFiles(files: File[]) {
    if (!editor || saveLock.current || checkingFiles) return;
    setCheckingFiles(true); setSaveError('');
    try {
      if ((editor.input.attachments?.length || 0) + pendingFiles.length + files.length > 10) throw new Error('You can attach up to 10 files per sermon.');
      for (const file of files) await validateSermonFile(file);
      setPendingFiles(previous => [...previous, ...files.map(file => ({ id: generateUUID(), file }))]);
    } catch (e) { setSaveError(e instanceof Error ? e.message : 'Unable to attach these files.'); }
    finally { setCheckingFiles(false); if (fileInput.current) fileInput.current.value = ''; }
  }
  async function submit(status: SermonInput['status']) {
    if (!editor || !currentUser || saveLock.current || checkingFiles) return;
    saveLock.current = true; setSaving(true); setSaveError(''); setSaveLabel('Saving…');
    let uploaded = [...(editor.input.attachments || [])];
    try {
      // Validate before uploading. Pending files count as content but are not persisted as metadata yet.
      sermonPayload({ ...editor.input, attachments: [...uploaded, ...pendingFiles.map(item => ({ id: item.id, name: item.file.name, path: '', size: item.file.size, kind: item.file.name.toLowerCase().endsWith('.pdf') ? 'pdf' as const : 'docx' as const }))] });
      for (const item of pendingFiles) {
        setSaveLabel('Uploading…');
        const attachment = await uploadSermonFile(item.file, editor.original?.author_id || currentUser.id, editor.newId);
        uploaded = [...uploaded, attachment];
        setEditor(previous => previous ? { ...previous, input: { ...previous.input, attachments: uploaded } } : previous);
        setPendingFiles(previous => previous.filter(file => file.id !== item.id));
      }
      setSaveLabel('Saving…');
      const input = { ...editor.input, outline_html: editor.input.outline_html ? sanitizeOutline(editor.input.outline_html) : null, attachments: uploaded, status };
      const saved = await saveSermon(input, currentUser.id, editor.original, editor.newId);
      if (!alive.current) return;
      setRows(previous => [...previous.filter(row => row.id !== saved.id), saved]);
      const savedPaths = new Set(saved.attachments?.map(item => item.path));
      void removeUnusedSermonFiles((editor.original?.attachments || []).filter(item => !savedPaths.has(item.path)).map(item => item.path));
      setEditor(null); setPendingFiles([]); openSermon(saved);
    } catch (e) {
      if (alive.current) setSaveError(e instanceof Error ? e.message : 'Unable to save. Your outline and attachments are still here.');
    } finally { saveLock.current = false; if (alive.current) setSaving(false); }
  }
  async function toggleDone() {
    if (!selected || saveLock.current || !currentUser) return;
    saveLock.current = true; setSaving(true); setCopyMessage('');
    try {
      const saved = await saveSermon({ service_date: selected.service_date, title: selected.title, preacher: selected.preacher, outline: selected.outline, outline_html: selected.outline_html, attachments: selected.attachments || [], status: selected.status, is_done: !selected.is_done }, currentUser.id, selected);
      setRows(previous => previous.map(row => row.id === saved.id ? saved : row));
    } catch (e) { setCopyMessage(e instanceof Error ? e.message : 'Unable to update this sermon.'); }
    finally { saveLock.current = false; setSaving(false); }
  }
  async function copy() {
    if (!selected) return;
    try {
      if (selected.outline_html && typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([selected.outline], { type: 'text/plain' }), 'text/html': new Blob([sanitizeOutline(selected.outline_html)], { type: 'text/html' }) })]);
      } else await navigator.clipboard.writeText(selected.outline);
      setCopyMessage('Copied.');
    } catch { setCopyMessage('Copy unavailable. Select the outline text and copy it.'); }
  }
  function screenKeys(event: React.KeyboardEvent) {
    if (event.key === 'Escape') { event.stopPropagation(); if (editor) closeEditor(); else if (!saveLock.current) closeReader(); }
    if (event.key === 'Tab') {
      const controls = Array.from(surface.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [contenteditable="true"], select, iframe') || []).filter(item => item.offsetParent !== null);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === surface.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === surface.current)) { event.preventDefault(); first?.focus(); }
    }
  }
  return <div className="space-y-4 text-slate-900 dark:text-white">
    {error && !fullScreen && <p role="alert" className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-900 dark:text-amber-200">{error}</p>}
    <div className="relative"><Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" /><input type="search" aria-label="Search sermons" placeholder="Search sermons" className={`${field} pl-9`} value={search} onChange={event => setSearch(event.target.value)} /></div>
    {canAdd && <button type="button" disabled={!ready} className={`${primary} w-full flex justify-center items-center gap-2`} onClick={startNew}><Plus className="w-4 h-4" />Add outline</button>}
    {loading && !ready && <p role="status" className="text-sm text-slate-500">Loading outlines…</p>}
    {ready && visible.length === 0 && <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center text-slate-500"><FileText className="w-8 h-8 mx-auto mb-2" /><p>{search ? 'No matching sermons.' : 'No sermons yet.'}</p></div>}
    {visible.map(row => {
      const past = row.service_date < today || !!row.is_done;
      return <button key={row.id} type="button" onClick={() => openSermon(row)} className={`w-full text-left rounded-xl border p-4 flex gap-3 items-start ${past ? 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400' : 'bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-900 hover:border-indigo-400'}`}>
        <div className={`w-12 rounded-xl p-2 text-center shrink-0 ${past ? 'bg-slate-200 dark:bg-slate-700' : 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'}`}><span className="block text-[10px] uppercase font-semibold">{formatDateStr(row.service_date, { shortMonth: true }).split(' ')[0]}</span><span className="block text-xl font-bold">{Number(row.service_date.split('-')[2])}</span></div>
        <div className="flex-1 min-w-0"><div className="flex justify-between gap-2"><h3 className="font-semibold break-words">{row.title}</h3>{row.status === 'draft' && <span className={`text-xs shrink-0 ${past ? '' : 'text-amber-600'}`}>Draft</span>}</div><p className="text-sm mt-1">{row.preacher}</p><p className="text-xs mt-1">{formatDateStr(row.service_date)}{row.is_done ? ' · Done' : ''}</p>{!!row.attachments?.length && <span className="mt-2 flex items-center gap-1 text-xs"><Paperclip className="w-3 h-3" />{row.attachments.length}</span>}</div>
      </button>;
    })}
    {selected && !editor && <div ref={surface} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="sermon-reader-title" className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-950 outline-none" onKeyDown={screenKeys}>
      <header className="shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 sm:px-5 pt-[env(safe-area-inset-top)]">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-1 py-1"><button type="button" className={action} aria-label="Back to sermons" onClick={closeReader} disabled={saving}><ArrowLeft className="w-5 h-5" /></button><div className="flex gap-1">
          {source === 'outline' && <><button type="button" className={action} aria-label="Decrease text size" disabled={fontSize <= 14} onClick={() => setFontSize(size => Math.max(14, size - 2))}>A−</button><button type="button" className={action} aria-label="Increase text size" disabled={fontSize >= 32} onClick={() => setFontSize(size => Math.min(32, size + 2))}>A+</button><button type="button" className={action} aria-label="Copy outline" title="Copy outline" onClick={() => void copy()}><Copy className="w-4 h-4" /></button></>}
          {canEdit(selected) && <><button type="button" className={action} aria-label="Edit outline" title="Edit outline" disabled={saving} onClick={() => startEdit(selected)}><Pencil className="w-4 h-4" /></button><button type="button" className={`${action} ${selected.is_done ? 'text-indigo-600' : ''}`} aria-label={selected.is_done ? 'Mark not done' : 'Mark done'} title={selected.is_done ? 'Mark not done' : 'Mark done'} aria-pressed={!!selected.is_done} disabled={saving} onClick={() => void toggleDone()}><Check className="w-4 h-4" /></button></>}
        </div></div>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto pb-[env(safe-area-inset-bottom)]"><article className="max-w-4xl mx-auto px-4 sm:px-8 py-5 sm:py-8">
        <h2 id="sermon-reader-title" className="text-xl sm:text-2xl font-bold break-words">{selected.title}</h2><p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{selected.preacher} · {formatDateStr(selected.service_date)}</p>
        {(attachments.length > 1 || (attachments.length > 0 && !!selected.outline.trim())) && <div className="flex gap-2 overflow-x-auto py-4" aria-label="Sermon content">{selected.outline.trim() && <button type="button" className={`${action} shrink-0 ${source === 'outline' ? 'bg-slate-100 dark:bg-slate-800' : ''}`} aria-pressed={source === 'outline'} onClick={() => setSource('outline')}>Outline</button>}{attachments.map(item => <button key={item.id} type="button" className={`${action} shrink-0 ${source === item.id ? 'bg-slate-100 dark:bg-slate-800' : ''}`} aria-pressed={source === item.id} onClick={() => setSource(item.id)}><Paperclip className="w-4 h-4" />{item.name}</button>)}</div>}
        {copyMessage && <p role="status" className="text-sm mt-3">{copyMessage}</p>}
        {source === 'outline' && <div className="sermon-prose mt-6" style={{ fontSize, tabSize: 4 }} dangerouslySetInnerHTML={{ __html: selected.outline_html ? sanitizeOutline(selected.outline_html) : plainTextHtml(selected.outline) }} />}
        {activeAttachment && <div className="mt-5 bg-white text-slate-900 rounded-xl p-2 sm:p-4"><Suspense fallback={<p role="status">Loading viewer…</p>}><AttachmentViewer key={activeAttachment.path} attachment={activeAttachment} /></Suspense></div>}
      </article></div>
    </div>}
    {editor && <div ref={surface} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="sermon-editor-title" className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-950 outline-none" onKeyDown={screenKeys}>
      <header className="shrink-0 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-5 pt-[env(safe-area-inset-top)]"><div className="max-w-4xl mx-auto flex justify-between items-center py-2"><h2 id="sermon-editor-title" className="font-semibold">{editor.original ? 'Edit outline' : 'Add outline'}</h2><button type="button" disabled={saving || checkingFiles} aria-label="Close editor" className={action} onClick={closeEditor}><X className="w-5 h-5" /></button></div></header>
      <form onSubmit={event => { event.preventDefault(); void submit('published'); }} className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 min-h-0 overflow-y-auto"><div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
          <fieldset disabled={saving || checkingFiles} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block text-sm">Service date<input required type="date" className={`${field} mt-1`} value={editor.input.service_date} onChange={event => setEditor({ ...editor, input: { ...editor.input, service_date: event.target.value } })} /></label>
            <label className="block text-sm">Preacher<input required placeholder="Preacher's name" className={`${field} mt-1`} value={editor.input.preacher} onChange={event => setEditor({ ...editor, input: { ...editor.input, preacher: event.target.value } })} /></label>
            <label className="block text-sm sm:col-span-2">Sermon title<input required className={`${field} mt-1`} value={editor.input.title} onChange={event => setEditor({ ...editor, input: { ...editor.input, title: event.target.value } })} /></label>
          </fieldset>
          <div><p className="text-sm mb-1">Outline</p><RichOutlineEditor key={editor.newId} html={editor.input.outline_html} text={editor.input.outline} disabled={saving || checkingFiles} onChange={(html, text) => setEditor(previous => previous ? { ...previous, input: { ...previous.input, outline_html: html, outline: text } } : previous)} /></div>
          <input ref={fileInput} type="file" multiple accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={event => void addFiles(Array.from(event.target.files || []))} />
          <button type="button" disabled={saving || checkingFiles} className={`${action} border border-slate-200 dark:border-slate-700`} onClick={() => fileInput.current?.click()}><Paperclip className="w-4 h-4" />{checkingFiles ? 'Checking files…' : 'Add attachment'}</button>
          {(editor.input.attachments || []).map(item => <div key={item.id} className="flex gap-2 items-center rounded-xl bg-slate-50 dark:bg-slate-900 p-3"><FileText className="w-4 h-4 shrink-0" /><span className="text-sm break-all flex-1">{item.name}</span><button type="button" disabled={saving} className={action} aria-label={`Remove ${item.name}`} onClick={() => {
            setEditor(previous => previous ? { ...previous, input: { ...previous.input, attachments: previous.input.attachments?.filter(file => file.id !== item.id) } } : previous);
            if (!editor.original?.attachments?.some(file => file.path === item.path)) void removeUnusedSermonFiles([item.path]);
          }}><X className="w-4 h-4" /></button></div>)}
          {pendingFiles.map(item => <div key={item.id} className="flex gap-2 items-center rounded-xl bg-slate-50 dark:bg-slate-900 p-3"><FileText className="w-4 h-4 shrink-0" /><span className="text-sm break-all flex-1">{item.file.name}</span><button type="button" disabled={saving} className={action} aria-label={`Remove ${item.file.name}`} onClick={() => setPendingFiles(previous => previous.filter(file => file.id !== item.id))}><X className="w-4 h-4" /></button></div>)}
          {saveError && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{saveError}</p>}
        </div></div>
        <footer className="shrink-0 border-t border-slate-200 dark:border-slate-800 px-3 sm:px-5 pb-[env(safe-area-inset-bottom)]"><div className="max-w-4xl mx-auto flex justify-end gap-2 py-3"><button type="button" disabled={saving || checkingFiles} className={action} onClick={() => void submit('draft')}>{editor.original?.status === 'published' ? 'Make draft' : 'Save draft'}</button><button type="submit" disabled={saving || checkingFiles} className={primary}>{saving ? saveLabel : editor.original?.status === 'published' ? 'Save & publish' : 'Publish'}</button></div></footer>
      </form>
    </div>}
  </div>;
}
