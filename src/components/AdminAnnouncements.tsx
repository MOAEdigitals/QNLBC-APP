import React, { useEffect, useRef, useState } from 'react';
import { loadAnnouncementAdmin, sendAnnouncement, type AnnouncementRecipient, type AnnouncementHistory } from '../services/adminAnnouncements';
import { useBackLayer } from '../hooks/useBackLayer';
const field = 'mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 dark:border-slate-700';
const statusLabel = { accepted: 'Push accepted by provider', queued: 'Push queued', failed: 'Push unsuccessful', inbox_only: 'Inbox only — no enabled device' };
export function AdminAnnouncements() {
  const [people, setPeople] = useState<AnnouncementRecipient[]>([]);
  const [history, setHistory] = useState<AnnouncementHistory[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState(false);
  const lock = useRef(false);
  // Retain the same request ID on uncertain responses; edits create a new request.
  const request = useRef<{ fingerprint: string; id: string } | null>(null);
  const refresh = async () => {
    setLoading(true);
    try {
      const result = await loadAnnouncementAdmin(); setPeople(result.recipients); setHistory(result.history);
      setSelected(previous => previous.filter(id => result.recipients.some(person => person.id === id))); setError('');
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);
  useBackLayer(preview, () => { if (!lock.current) setPreview(false); });
  const recipients = people.filter(person => selected.includes(person.id));
  const send = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    const ids = recipients.map(person => person.id).sort();
    const fingerprint = JSON.stringify([title.trim(), body.trim(), ids]);
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
    try {
      await sendAnnouncement(request.current.id, title, body, ids);
      setPreview(false); setTitle(''); setBody(''); setSelected([]); request.current = null;
      setNotice(`Sent to ${ids.length} ${ids.length === 1 ? 'account' : 'accounts'}. Phone pushes are queued for enabled devices.`);
      await refresh();
    } catch (e) { setError((e as Error).message); }
    finally { lock.current = false; setBusy(false); }
  };
  const form = <>
    <p className="text-sm text-slate-500">Send a message to notification inboxes and enabled Android devices. Only active accounts are listed.</p>
    <label className="block text-sm font-medium">Title<input required maxLength={120} className={field} value={title} onChange={e => { setTitle(e.target.value); setNotice(''); }} /></label>
    <label className="block text-sm font-medium">Message<textarea required maxLength={2000} rows={5} className={field} value={body} onChange={e => { setBody(e.target.value); setNotice(''); }} /><span className="text-xs text-slate-500">{body.length}/2000</span></label>
    <fieldset className="space-y-3"><legend className="font-semibold">Recipients · {recipients.length} selected</legend>
      <div className="flex flex-wrap gap-2"><button type="button" className="ui-secondary" disabled={loading} onClick={() => setSelected(people.map(person => person.id))}>Select all active users</button><button type="button" className="ui-secondary" onClick={() => setSelected([])}>Clear selection</button></div>
      <label className="block text-sm">Find member<input className={field} type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or username" /></label>
      <div className="max-h-80 overflow-y-auto divide-y divide-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 dark:divide-slate-700">
        {people.filter(person => `${person.name} ${person.username}`.toLowerCase().includes(search.trim().toLowerCase())).map(person => <label key={person.id} className="flex cursor-pointer items-start gap-3 p-3"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={selected.includes(person.id)} onChange={e => setSelected(previous => e.target.checked ? [...previous, person.id] : previous.filter(id => id !== person.id))} /><span className="min-w-0"><span className="block break-words font-medium">{person.name}</span><span className="block text-sm text-slate-500">{person.username}</span><span className="block text-xs text-slate-500">{person.push_enabled ? 'Android push enabled' : 'Inbox only — no enabled device'}</span></span></label>)}
      </div>
    </fieldset>
    <button type="submit" className="ui-primary" disabled={loading || !recipients.length || !title.trim() || !body.trim()}>Preview notification</button>
  </>;
  return <section className="space-y-5">
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{notice}</p>}
    {!preview && error && <p role="alert" className="text-rose-600">{error}</p>}
    <button type="button" className="ui-secondary" disabled={loading || busy} onClick={() => void refresh()}>{loading ? 'Loading…' : 'Refresh recipients & history'}</button>
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); setError(''); setPreview(true); }}>{form}</form>
    {preview && <AnnouncementPreview title={title.trim()} body={body.trim()} recipients={recipients} busy={busy} error={error} onCancel={() => setPreview(false)} onSend={() => void send()} />}
    <section className="space-y-3" aria-label="Sent announcements"><h3 className="text-lg font-semibold">Sent history</h3><p className="text-xs text-slate-500">Latest 50 announcements. Provider acceptance does not confirm phone delivery or reading. Read means opened in the app.</p>
      {!history.length && !loading && <p className="text-sm text-slate-500">No announcements sent yet.</p>}
      {history.map(item => <details key={item.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"><summary className="cursor-pointer"><span className="font-semibold">{item.title}</span><span className="block text-xs text-slate-500">{new Date(item.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} · {item.recipients.length} accounts · {item.sender_name}</span></summary><p className="my-3 whitespace-pre-wrap break-words">{item.body}</p><ul className="space-y-2 text-sm">{item.recipients.map(person => <li key={person.id}><span className="font-medium">{person.name}</span> <span className="text-slate-500">({person.username})</span><span className="block text-xs text-slate-500">{statusLabel[person.status]} · {person.read_at ? 'Read in app' : 'Not opened in app'}</span></li>)}</ul></details>)}
    </section>
  </section>;
}
function AnnouncementPreview({ title, body, recipients, busy, error, onCancel, onSend }: { title: string; body: string; recipients: AnnouncementRecipient[]; busy: boolean; error: string; onCancel: () => void; onSend: () => void }) {
  return <div role="dialog" aria-modal="true" aria-labelledby="announcement-preview-title" className="ui-form-screen fixed inset-0 z-[195] flex flex-col bg-white dark:bg-slate-950" data-no-swipe>
    <header className="border-b border-slate-200 p-4 dark:border-slate-800"><h3 id="announcement-preview-title" className="text-lg font-semibold">Preview notification</h3></header>
    <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4"><div className="rounded-xl border border-indigo-300 bg-indigo-50 p-4 dark:bg-indigo-950/30"><h4 className="font-semibold break-words">{title}</h4><p className="mt-2 whitespace-pre-wrap break-words">{body}</p></div><p className="font-semibold">Send to {recipients.length} {recipients.length === 1 ? 'account' : 'accounts'}</p><ul className="space-y-1 text-sm">{recipients.map(person => <li key={person.id}>{person.name} ({person.username})</li>)}</ul><p className="text-xs text-slate-500">This sends immediately to their inboxes. Android push delivery follows for enabled devices.</p>{error && <p role="alert" className="text-rose-600">{error}</p>}</div>
    <div className="ui-form-actions flex justify-end gap-3"><button type="button" className="ui-secondary" disabled={busy} onClick={onCancel}>Back to edit</button><button type="button" className="ui-primary" disabled={busy} onClick={onSend}>{busy ? 'Sending…' : `Send to ${recipients.length} ${recipients.length === 1 ? 'account' : 'accounts'}`}</button></div>
  </div>;
}
