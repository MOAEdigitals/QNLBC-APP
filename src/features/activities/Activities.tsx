import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Loader2, MoreVertical, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { ChurchActivity, UserAccount } from '../../types';
import { generateUUID } from '../../services/supabaseData';
import { monthList } from '../../components/MonthSeparators';
import { deleteActivity, fetchActivities, saveActivity } from './data';
import { useBackLayer } from '../../hooks/useBackLayer';

const field = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-base text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white';
const action = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold disabled:opacity-50';

function localDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayKey() {
  return dateKey(new Date());
}

function sortActivities(items: ChurchActivity[]) {
  return [...items].sort((a, b) => {
    const dateOrder = a.activityDate.localeCompare(b.activityDate);
    return dateOrder || (a.activityTime || '').localeCompare(b.activityTime || '');
  });
}

export default function Activities({ currentUser }: { currentUser: UserAccount | null }) {
  const now = new Date();
  const [month, setMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [items, setItems] = useState<ChurchActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editor, setEditor] = useState<{ item: ChurchActivity; isNew: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const savingRef = useRef(false);
  const canAdd = currentUser?.role === 'admin' || !!currentUser?.permissions?.canAdd;
  const canEdit = currentUser?.role === 'admin' || !!currentUser?.permissions?.canEdit;
  const canDelete = currentUser?.role === 'admin' || !!currentUser?.permissions?.canDelete;

  const load = async () => {
    try {
      setLoadError('');
      setItems(sortActivities(await fetchActivities()));
    } catch (error) {
      console.error('Failed to load activities:', error);
      setLoadError('Could not load activities.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);
  useBackLayer(!!editor, () => { if (!savingRef.current) setEditor(null); });

  const counts = useMemo(() => {
    const result = new Map<string, number>();
    for (const item of items) result.set(item.activityDate, (result.get(item.activityDate) || 0) + 1);
    return result;
  }, [items]);

  const calendarDays = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, index) => index + 1)];
  }, [month]);

  const openNew = (date = todayKey()) => {
    setSaveError('');
    setEditor({ item: { id: generateUUID(), title: '', activityDate: date, activityTime: '' }, isNew: true });
  };

  const showActivitiesForDate = (date: string) => {
    setSelectedDate(date);
    const first = items.find(item => item.activityDate === date);
    if (!first) return;
    document.getElementById(`activity-card-${first.id}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editor || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    try {
      const saved = await saveActivity(editor.item, editor.isNew);
      setItems(previous => sortActivities(editor.isNew ? [...previous, saved] : previous.map(item => item.id === saved.id ? saved : item)));
      setMonth(new Date(localDate(saved.activityDate).getFullYear(), localDate(saved.activityDate).getMonth(), 1));
      setEditor(null);
    } catch (error) {
      console.error('Failed to save activity:', error);
      setSaveError('Could not save activity.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const remove = async (item: ChurchActivity) => {
    setOpenMenu(null);
    if (!window.confirm(`Delete “${item.title}”?`)) return;
    try {
      await deleteActivity(item.id);
      setItems(previous => previous.filter(existing => existing.id !== item.id));
    } catch (error) {
      console.error('Failed to delete activity:', error);
      setLoadError('Could not delete activity.');
    }
  };

  return <div className="relative space-y-4 pb-16" onClick={() => setOpenMenu(null)}>
    <section aria-label="Activity calendar" className="rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900">
      <header className="mb-3 flex items-center justify-between">
        <button type="button" className={action} aria-label="Previous month" onClick={() => setMonth(value => new Date(value.getFullYear(), value.getMonth() - 1, 1))}><ChevronLeft className="h-5 w-5" /></button>
        <h2 className="text-base font-bold">{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
        <button type="button" className={action} aria-label="Next month" onClick={() => setMonth(value => new Date(value.getFullYear(), value.getMonth() + 1, 1))}><ChevronRight className="h-5 w-5" /></button>
      </header>
      <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-slate-400" aria-hidden="true">{['S','M','T','W','T','F','S'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-y-1">
        {calendarDays.map((day, index) => {
          if (!day) return <span key={`blank-${index}`} />;
          const key = dateKey(new Date(month.getFullYear(), month.getMonth(), day));
          const count = counts.get(key) || 0;
          const isSelected = key === selectedDate;
          return <button key={key} type="button" onClick={() => showActivitiesForDate(key)} className="flex min-h-11 flex-col items-center justify-center rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-slate-800" aria-label={`${key}${count ? `, ${count} ${count === 1 ? 'activity' : 'activities'}` : ''}`}>
            <span className={`flex h-7 w-7 items-center justify-center rounded-full ${isSelected ? 'bg-indigo-100 font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200' : ''}`}>{day}</span>
            <span className="flex h-2 items-center justify-center gap-0.5" aria-hidden="true">{Array.from({ length: Math.min(count, 3) }, (_, dot) => <i key={dot} className="h-1 w-1 rounded-full bg-amber-500" />)}</span>
          </button>;
        })}
      </div>
    </section>

    {loadError && <p role="alert" className="px-1 text-sm text-rose-600 dark:text-rose-400">{loadError}</p>}
    {loading ? <p role="status" className="py-8 text-center text-sm text-slate-500">Loading…</p> : items.length === 0 ? <div className="py-8 text-center"><CalendarDays className="mx-auto h-6 w-6 text-slate-400" /><p className="mt-2 text-sm text-slate-500">No activities yet.</p></div> : <div className="space-y-2">
      {monthList(items, item => item.activityDate, ['activity', 'activities']).render(item => {
        const date = localDate(item.activityDate);
        return <article id={`activity-card-${item.id}`} key={item.id} className="relative flex min-h-[72px] scroll-mt-4 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800"><span className="text-[10px] font-bold uppercase text-slate-500">{date.toLocaleDateString('en-US', { weekday: 'short' })}</span><span className="text-lg font-bold leading-none">{date.getDate()}</span></div>
          <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold">{item.title}</h3>{item.activityTime && <p className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><Clock className="h-3 w-3" />{new Date(`2000-01-01T${item.activityTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>}</div>
          {(canEdit || canDelete) && <div className="relative"><button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl" aria-label={`Actions for ${item.title}`} onClick={event => { event.stopPropagation(); setOpenMenu(openMenu === item.id ? null : item.id); }}><MoreVertical className="h-4 w-4" /></button>{openMenu === item.id && <div className="absolute right-0 top-10 z-20 w-36 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900" onClick={event => event.stopPropagation()}>{canEdit && <button type="button" className={`${action} w-full justify-start`} onClick={() => { setSaveError(''); setEditor({ item: { ...item }, isNew: false }); setOpenMenu(null); }}><Pencil className="h-4 w-4" />Edit</button>}{canDelete && <button type="button" className={`${action} w-full justify-start text-rose-600`} onClick={() => void remove(item)}><Trash2 className="h-4 w-4" />Delete</button>}</div>}</div>}
        </article>;
      })}
    </div>}

    {canAdd && <button type="button" aria-label="Add activity" title="Add activity" className="fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg dark:bg-white dark:text-slate-900 sm:absolute sm:bottom-0 sm:right-0" onClick={() => openNew()}><Plus className="h-6 w-6" /></button>}

    {editor && <div role="dialog" aria-modal="true" aria-labelledby="activity-editor-title" className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-950 sm:items-center sm:justify-center sm:bg-black/50 sm:p-4">
      <form onSubmit={submit} className="flex h-full w-full flex-col bg-white dark:bg-slate-950 sm:h-auto sm:max-w-md sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800"><h2 id="activity-editor-title" className="font-semibold">{editor.isNew ? 'New activity' : 'Edit activity'}</h2><button type="button" disabled={saving} className="flex h-10 w-10 items-center justify-center rounded-xl" aria-label="Close" onClick={() => setEditor(null)}><X className="h-5 w-5" /></button></header>
        <fieldset disabled={saving} className="flex-1 space-y-4 overflow-y-auto p-4">
          <label className="block text-sm font-medium">Title<input required autoFocus className={`${field} mt-1.5`} value={editor.item.title} onChange={event => setEditor({ ...editor, item: { ...editor.item, title: event.target.value } })} /></label>
          <label className="block text-sm font-medium">Date<input required type="date" className={`${field} mt-1.5`} value={editor.item.activityDate} onChange={event => setEditor({ ...editor, item: { ...editor.item, activityDate: event.target.value } })} /></label>
          <label className="block text-sm font-medium">Time <span className="font-normal text-slate-400">(optional)</span><input type="time" className={`${field} mt-1.5`} value={editor.item.activityTime || ''} onChange={event => setEditor({ ...editor, item: { ...editor.item, activityTime: event.target.value } })} /></label>
          {saveError && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{saveError}</p>}
        </fieldset>
        <footer className="border-t border-slate-200 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] dark:border-slate-800"><button type="submit" disabled={saving || !editor.item.title.trim() || !editor.item.activityDate} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? 'Saving…' : 'Save'}</button></footer>
      </form>
    </div>}
  </div>;
}
