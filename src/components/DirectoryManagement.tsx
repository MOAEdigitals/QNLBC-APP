import { SheetSelect } from './SheetSelect';
import React, { useRef, useState } from 'react';
import { Pencil, Plus, Search, X } from 'lucide-react';
import { useBackLayer } from '../hooks/useBackLayer';
import { saveDirectoryMember, type DirectoryMember } from '../services/directory';
export function DirectoryAccountSelect({ members, value, accountId, onChange }: { members: DirectoryMember[]; value: string; accountId?: string; onChange: (id: string, name: string) => void }) {
  return <label className="block text-sm font-medium">Directory link (optional)<SheetSelect value={value} onChange={event => { const member = members.find(person => person.id === event.target.value); onChange(member?.id || '', member?.name || ''); }} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900">
    <option value="">No directory link</option>{members.filter(member => member.active || member.id === value).map(member => <option key={member.id} value={member.id} disabled={!!member.linked_user_id && member.linked_user_id !== accountId}>{member.name}{member.linked_user_id && member.linked_user_id !== accountId ? ' — linked' : ''}</option>)}
  </SheetSelect></label>;
}
export function DirectoryManagement({ members, onRefresh }: { members: DirectoryMember[]; onRefresh: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const lock = useRef(false);
  const cancel = () => { if (!lock.current) { setEditing(null); setAdding(false); setName(''); setError(''); } };
  useBackLayer(adding || !!editing, cancel);
  const active = members.filter(member => member.active);
  const visible = active.filter(member => member.name.toLowerCase().includes(search.trim().toLowerCase()));
  const save = async (id: string | null, text: string, active = true) => {
    if (lock.current || !text.trim()) return;
    lock.current = true;
    setBusy(true); setError(''); setNotice('');
    try { await saveDirectoryMember(id, text, active); setName(''); setEditing(null); setAdding(false); await onRefresh(); setNotice('Church directory updated.'); }
    catch (e) { setError((e as Error).message); }
    finally { lock.current = false; setBusy(false); }
  };
  const editor = <form className="space-y-3 py-3" onSubmit={event => { event.preventDefault(); void save(editing, name); }}><label className="block text-sm font-medium">{editing ? 'Rename person' : 'New person'}<input autoFocus required disabled={busy} maxLength={160} value={name} onChange={event => setName(event.target.value)} aria-label="Directory name" placeholder="Full name" className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-transparent px-3 dark:border-slate-700" /></label><div className="flex justify-end gap-2"><button type="button" disabled={busy} className="ui-secondary" onClick={cancel}>Cancel</button><button type="submit" disabled={busy || !name.trim()} className="ui-primary">{busy ? 'Saving…' : editing ? 'Save name' : 'Add person'}</button></div></form>;
  return <section className="settings-content-card space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm font-semibold">{active.length} people</span><button type="button" className="ui-primary" disabled={busy || adding || !!editing} onClick={() => { setAdding(true); setNotice(''); }}><Plus className="h-4 w-4" />Add person</button></div>
    <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-3 dark:border-slate-700"><Search className="h-4 w-4 shrink-0 text-slate-400" /><input type="search" aria-label="Search directory" placeholder="Search names" value={search} onChange={event => setSearch(event.target.value)} className="min-h-11 min-w-0 flex-1 bg-transparent outline-none" />{search && <button type="button" aria-label="Clear directory search" onClick={() => setSearch('')}><X className="h-4 w-4" /></button>}</label>
    {adding && editor}
    {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}{notice && <p role="status" className="text-sm text-emerald-600">{notice}</p>}
    <div className="divide-y divide-slate-200 dark:divide-slate-800">{visible.map(member => <div key={member.id}><div className="settings-person-row"><span aria-hidden="true" className="settings-person-avatar">{member.name.split(/\s+/).filter(Boolean).map(word => word[0]).slice(0,2).join('')}</span><div className="min-w-0"><p className="break-words font-semibold">{member.name}</p><p className="member-account-username text-slate-500">{member.linked_user_id ? (member.account_active ? 'Linked account' : 'Account inactive') : 'Directory only'}</p></div><button type="button" disabled={busy || adding} className="h-11 w-11 grid place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={`Rename ${member.name}`} title="Rename" onClick={() => { setEditing(member.id); setName(member.name); setNotice(''); setError(''); }}><Pencil className="h-4 w-4" aria-hidden="true" /></button></div>{editing === member.id && editor}</div>)}</div>
    {!visible.length && <p className="py-6 text-center text-sm text-slate-500">{search ? 'No matching names.' : 'No people yet.'}</p>}
  </section>;
}
