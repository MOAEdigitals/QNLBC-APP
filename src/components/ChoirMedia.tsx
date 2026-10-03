import React, { useRef, useState } from 'react';
import { Paperclip, Play, Trash2, X, ExternalLink } from 'lucide-react';
import type { ChoirEntry, ChoirMediaAttachment, UserAccount } from '../types';
import { generateUUID } from '../services/supabaseData';
import { getYouTubeEmbedUrl, resolveMediaUrl } from '../utils/mediaUtils';
const parts = ['Soprano', 'Alto', 'Tenor', 'Bass', 'Minus One', 'Plus One', 'Other'];
export function ChoirMedia({ entry, currentUser, onSave }: { entry: ChoirEntry; currentUser: UserAccount | null; onSave?: (entry: ChoirEntry) => Promise<void> }) {
  const [adding, setAdding] = useState(false);
  const [part, setPart] = useState('Soprano');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'audio' | 'video'>('audio');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const canEdit = !!currentUser?.active && (currentUser.role === 'admin' || !!currentUser.permissions?.canEdit);
  const canDelete = canEdit && (currentUser?.role === 'admin' || !!currentUser?.permissions?.canDelete);
  const files = entry.mediaAttachments || [];
  const active = files.find(item => item.id === activeId);
  const embed = active ? getYouTubeEmbedUrl(active.url) : null;
  async function persist(next: ChoirMediaAttachment[]) {
    if (lock.current || !onSave) return false;
    lock.current = true; setSaving(true); setError('');
    try { await onSave({ ...entry, mediaAttachments: next }); return true; }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to save attachment.'); return false; }
    finally { lock.current = false; setSaving(false); }
  }
  async function add(event: React.FormEvent) {
    event.preventDefault();
    try { const parsed = new URL(url.trim()); if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error(); }
    catch { setError('Enter a valid https:// or http:// link.'); return; }
    if (await persist([...files, { id: generateUUID(), part, title: title.trim() || part, url: url.trim(), kind }])) { setAdding(false); setUrl(''); setTitle(''); }
  }
  return <section className="space-y-3" aria-label="Choir media">
    <div className="space-y-2">{files.map(item => <div key={item.id} className="flex gap-2 items-center rounded-xl border border-slate-200 dark:border-slate-700 p-2">
      <button type="button" aria-label={`Play ${item.title}`} aria-pressed={activeId === item.id} onClick={() => setActiveId(activeId === item.id ? null : item.id)} className="flex-1 min-w-0 flex items-center gap-3 text-left p-1"><Play className="w-4 h-4 shrink-0" /><span className="min-w-0"><span className="block text-sm font-semibold">{item.part}</span>{item.title !== item.part && <span className="block text-xs truncate">{item.title}</span>}</span></button>
      {canDelete && <button type="button" disabled={saving} aria-label={`Delete ${item.title} attachment`} className="p-2 text-rose-500" onClick={async () => { if (window.confirm(`Delete “${item.title}” attachment?`) && await persist(files.filter(file => file.id !== item.id))) { if (activeId === item.id) setActiveId(null); } }}><Trash2 className="w-4 h-4" /></button>}
    </div>)}</div>
    {active && <div className="space-y-2">{embed ? <iframe key={active.id} title={active.title} src={embed} className="w-full aspect-video rounded-xl border-0" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /> : active.kind === 'video' ? <video key={active.id} src={resolveMediaUrl(active.url)} controls autoPlay playsInline className="w-full rounded-xl" /> : <audio key={active.id} src={resolveMediaUrl(active.url)} controls autoPlay className="w-full" />}
      <a href={active.url} target="_blank" rel="noopener noreferrer" className="inline-flex gap-1 items-center text-xs text-indigo-600 dark:text-indigo-300"><ExternalLink className="w-3 h-3" />Open link</a>
    </div>}
    {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}
    {canEdit && onSave && (adding ? <form onSubmit={add} className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
      <div className="flex justify-between items-center"><span className="text-sm font-semibold">Add attachment</span><button type="button" disabled={saving} aria-label="Close attachment form" onClick={() => setAdding(false)}><X className="w-4 h-4" /></button></div>
      <label className="block text-sm">Part<select disabled={saving} value={part} onChange={e => setPart(e.target.value)} className="block w-full p-2 rounded-lg border dark:bg-slate-800">{parts.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="block text-sm">Title (optional)<input disabled={saving} value={title} onChange={e => setTitle(e.target.value)} className="block w-full p-2 rounded-lg border dark:bg-slate-800" /></label>
      <label className="block text-sm">Link<input type="url" required disabled={saving} value={url} onChange={e => setUrl(e.target.value)} placeholder="YouTube or direct audio/video URL" className="block w-full p-2 rounded-lg border dark:bg-slate-800" /></label>
      <label className="block text-sm">Media<select disabled={saving} value={kind} onChange={e => setKind(e.target.value as 'audio' | 'video')} className="block w-full p-2 rounded-lg border dark:bg-slate-800"><option value="audio">Audio</option><option value="video">Video</option></select></label>
      <button disabled={saving} className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm">{saving ? 'Saving…' : 'Save attachment'}</button>
    </form> : <button type="button" onClick={() => { setAdding(true); setError(''); }} className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 py-3 text-sm font-semibold"><Paperclip className="w-4 h-4" />Add attachment</button>)}
  </section>;
}
