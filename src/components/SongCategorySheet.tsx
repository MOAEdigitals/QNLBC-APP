import React, { useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { BottomSheet } from './BottomSheet';

export function SongCategorySheet({ categories, selected, onSave, onClose }: {
  categories: string[]; selected: string[]; onSave: (categories: string[]) => Promise<unknown>; onClose: () => void;
}) {
  const [draft, setDraft] = useState(selected);
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  const lock = useRef(false);
  const close = () => { if (!lock.current) onClose(); };
  const save = async () => {
    if (lock.current) return;
    lock.current = true; setSaving(true); setError('');
    try { await onSave(draft); onClose(); }
    catch { setError('Could not save categories. Your selection is still here.'); }
    finally { lock.current = false; setSaving(false); }
  };
  return <BottomSheet open dismissible={!saving} title="Song categories" onClose={close} onBack={close}>
    <div className="ui-sheet-options ui-category-sheet">{categories.map(category => <button type="button" key={category} className="ui-sheet-option" aria-pressed={draft.includes(category)} disabled={saving} onClick={() => setDraft(current => current.includes(category) ? current.filter(value => value !== category) : [...current, category])}><span className="flex-1">{category}</span>{draft.includes(category) && <Check className="h-5 w-5" />}</button>)}</div>
    <button type="button" className="ui-secondary w-full mt-3" disabled={saving || !draft.length} onClick={() => setDraft([])}>Clear categories</button>
    {error && <p role="alert" className="pt-3 text-sm text-rose-500">{error}</p>}
    <div className="ui-sheet-actions"><button type="button" className="ui-secondary" disabled={saving} onClick={close}>Cancel</button><button type="button" className="ui-primary" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save categories'}</button></div>
  </BottomSheet>;
}
