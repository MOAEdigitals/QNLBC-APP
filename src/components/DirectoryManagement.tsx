import React, { useState } from 'react';
import { Pencil } from 'lucide-react';
import { saveDirectoryMember, type DirectoryMember } from '../services/directory';
export function DirectoryAccountSelect({ members, value, accountId, onChange }: { members: DirectoryMember[]; value: string; accountId?: string; onChange: (id: string, name: string) => void }) {
  return <label className="block text-sm font-medium">Church directory link (optional)<select value={value} onChange={event => { const member = members.find(person => person.id === event.target.value); onChange(member?.id || '', member?.name || ''); }} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900">
    <option value="">No directory link</option>{members.filter(member => member.active || member.id === value).map(member => <option key={member.id} value={member.id} disabled={!!member.linked_user_id && member.linked_user_id !== accountId}>{member.name}{member.linked_user_id && member.linked_user_id !== accountId ? ' — already linked to an account' : ''}</option>)}
  </select></label>;
}
export function DirectoryManagement({ members, onRefresh }: { members: DirectoryMember[]; onRefresh: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const save = async (id: string | null, text: string, active = true) => {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await saveDirectoryMember(id, text, active); setName(''); setEditing(null); await onRefresh(); setNotice('Church directory updated.'); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  return <section className="space-y-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
    <h3 className="font-semibold">Church directory</h3>
    <form className="flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); void save(editing, name); }}><label className="min-w-0 flex-1"><span className="sr-only">Directory name</span><input required maxLength={160} value={name} onChange={event => setName(event.target.value)} placeholder="Full name" className="min-h-11 w-full rounded-xl border border-slate-300 bg-transparent px-3 dark:border-slate-700" /></label><button type="submit" disabled={busy || !name.trim()} className="ui-primary">{busy ? 'Saving…' : editing ? 'Save name' : 'Add person'}</button>{editing && <button type="button" className="ui-secondary" onClick={() => { setEditing(null); setName(''); }}>Cancel</button>}</form>
    {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}{notice && <p role="status" className="text-sm text-emerald-600">{notice}</p>}
    <div className="divide-y divide-slate-200 dark:divide-slate-800">{members.filter(member => member.active).map(member => <div key={member.id} className="flex items-center gap-2 py-3"><div className="min-w-0 flex-1"><p className="break-words font-medium">{member.name}</p><p className="text-xs text-slate-500">{member.linked_user_id ? (member.account_active ? 'Account linked' : 'Account linked — inactive') : 'No linked account'}</p></div><button type="button" disabled={busy} className="ui-secondary h-11 w-11 shrink-0 justify-center p-0" aria-label={`Rename ${member.name}`} title="Rename" onClick={() => { setEditing(member.id); setName(member.name); }}><Pencil className="h-4 w-4" aria-hidden="true" /></button></div>)}</div>
  </section>;
}
