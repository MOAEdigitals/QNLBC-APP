import { useScreenRefresh } from '../../hooks/usePullToRefresh';
import { copyWithFeedback } from '../../services/clipboard';
import { calendarOverlays, EMPTY_OVERLAY_FILTERS } from './calendarOverlays';
import { yearList } from '../../components/MonthSeparators';
import { SheetDateField } from '../../components/SheetDateField';
import { confirmAction } from '../../services/appDialogs';
import { BottomSheet } from '../../components/BottomSheet';
import { UpcomingBadge } from '../../components/UpcomingBadge';
import { highlightActivityCards, scrollActivityBelowHeader } from './highlight';
import { CardDate } from '../../components/CardDate';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Copy, Filter, Loader2, MoreHorizontal, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { BirthdayCelebrant, ChurchActivity, UserAccount } from '../../types';
import { generateUUID } from '../../services/supabaseData';
import { deleteActivity, fetchActivities, saveActivity } from './data';
import { useBackLayer } from '../../hooks/useBackLayer';
import { useHeaderSearch } from '../../components/HeaderSearch';
import { activityKind, isPastActivity, orderActivityList, sortActivities, isRoutineActivity, groupActivityMonths } from './model';
import { useCalendarSwipe } from './useCalendarSwipe';

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

export default function Activities({ currentUser, collapseSignal, birthdays = [], onLoadBirthdays }: { currentUser: UserAccount | null; collapseSignal?: number; birthdays?: BirthdayCelebrant[]; onLoadBirthdays?: () => Promise<void> }) {
  const now = new Date();
  const [month, setMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const calendarRef = useCalendarSwipe(direction => setMonth(value => new Date(value.getFullYear(), value.getMonth() + direction, 1)));
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [today, setToday] = useState(todayKey);
  const [items, setItems] = useState<ChurchActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const resultsRef = useRef<HTMLDivElement>(null);
  const scrollToResults = useCallback(() => {
    if (resultsRef.current) scrollActivityBelowHeader(resultsRef.current, document.querySelector<HTMLElement>('[data-app-header]'), true);
  }, []);
  useEffect(() => { if (search.trim()) scrollToResults(); }, [search, scrollToResults]);
  const [editor, setEditor] = useState<{ item: ChurchActivity; isNew: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  const [showTime, setShowTime] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [overlayFilters, setOverlayFilters] = useState(EMPTY_OVERLAY_FILTERS);
  const [dateDetails, setDateDetails] = useState<string | null>(null);
  const [birthdaysLoading, setBirthdaysLoading] = useState(false);
  const [gatheringFilters, setGatheringFilters] = useState({ prayer: true, sunday: true, practice: false, other: true });
  const savingRef = useRef(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const lastProcessedSignalRef = useRef<number>(0);
  const canAdd = currentUser?.role === 'admin' || !!currentUser?.permissions?.canAdd;
  const canEdit = currentUser?.role === 'admin' || !!currentUser?.permissions?.canEdit;
  const canDelete = currentUser?.role === 'admin' || !!currentUser?.permissions?.canDelete;

  const activityFilter = useMemo(() => (
      <div ref={filterRef} className="relative">
        <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Filter activities" title="Filter activities" aria-expanded={showFilters} onClick={() => setShowFilters(value => !value)}><Filter className="h-5 w-5" /></button>
        <BottomSheet open={showFilters} title="Filter activities" onClose={() => setShowFilters(false)}><div className="space-y-1">
          {([['prayer', 'Prayer meetings'], ['sunday', 'Sunday service'], ['practice', 'Choir & song leader practice'], ['other', 'Other events']] as const).map(([key, label]) => <label key={key} className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm"><input type="checkbox" checked={gatheringFilters[key]} onChange={() => setGatheringFilters(value => ({ ...value, [key]: !value[key] }))} />{label}</label>)}
          <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-700">
            {([['ph', 'PH holidays', 'bg-cyan-500'], ['local', 'Local holidays (Nueva Ecija)', 'bg-violet-500'], ['birthday', 'Birthdays', 'bg-rose-500']] as const).map(([key, label, color]) => <label key={key} className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm"><input type="checkbox" checked={overlayFilters[key]} onChange={() => {
              const enabled = !overlayFilters[key];
              setOverlayFilters(value => ({ ...value, [key]: enabled }));
              if (key === 'birthday' && enabled && onLoadBirthdays) {
                setBirthdaysLoading(true);
                void onLoadBirthdays().catch(() => setLoadError('Could not load birthdays.')).finally(() => setBirthdaysLoading(false));
              }
            }} /><i aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${color}`} />{label}</label>)}
          </div>
        </div></BottomSheet>
      </div>
    ), [showFilters, gatheringFilters, overlayFilters, onLoadBirthdays]);
  useHeaderSearch({ value: search, onChange: setSearch, placeholder: 'Search activities',
    label: 'Search activities', beforeSearch: activityFilter, onOpen: scrollToResults });

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

  useScreenRefresh(load);
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const refreshToday = () => setToday(todayKey());
    const timer = window.setInterval(refreshToday, 60_000);
    window.addEventListener('focus', refreshToday);
    document.addEventListener('visibilitychange', refreshToday);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshToday);
      document.removeEventListener('visibilitychange', refreshToday);
    };
  }, []);
  useBackLayer(!!editor, () => { if (!savingRef.current) setEditor(null); });

  useEffect(() => {
    if (!collapseSignal || collapseSignal === lastProcessedSignalRef.current) return;
    lastProcessedSignalRef.current = collapseSignal;
    if (editor && !savingRef.current) { setEditor(null); return; }
    if (dateDetails) { setDateDetails(null); return; }
    if (showFilters) { setShowFilters(false); return; }
    if (openMenu) { setOpenMenu(null); return; }
    if (expandedActivity) { setExpandedActivity(null); return; }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [collapseSignal, editor, showFilters, openMenu, expandedActivity, dateDetails]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orderActivityList(items.filter(item => {
      if (!gatheringFilters[activityKind(item.title)]) return false;
      return !query || `${item.title} ${item.description || ''}`.toLowerCase().includes(query);
    }), today);
  }, [items, search, gatheringFilters, today]);
  const counts = useMemo(() => {
    const result = new Map<string, number>();
    for (const item of filteredItems) result.set(item.activityDate, (result.get(item.activityDate) || 0) + 1);
    return result;
  }, [filteredItems]);
  const overlays = useMemo(() => calendarOverlays(month.getFullYear(), birthdays, overlayFilters, search), [month, birthdays, overlayFilters, search]);
  const overlaysByDate = useMemo(() => {
    const result = new Map<string, typeof overlays>();
    for (const entry of overlays) result.set(entry.date, [...(result.get(entry.date) || []), entry]);
    return result;
  }, [overlays]);
  const nextActivityId = filteredItems.find(item => !isPastActivity(item.activityDate, today))?.id;
  const followingActivityId = filteredItems.find(item => !isPastActivity(item.activityDate, today) && item.id !== nextActivityId)?.id;
  // Completed dates stay at the end of their year, after every upcoming month.
  const activityGroups = groupActivityMonths(filteredItems, today);

  useEffect(() => {
    if (!openMenu) return;
    const close = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(`[data-activity-actions="${openMenu}"]`)) setOpenMenu(null);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); setOpenMenu(null); } };
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('click', close, true);
    document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', close, true); document.removeEventListener('click', close, true); document.removeEventListener('keydown', escape, true); };
  }, [openMenu]);


  const copyActivity = async (item: ChurchActivity) => {
    const date = localDate(item.activityDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const time = item.activityTime ? new Date(`2000-01-01T${item.activityTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
    if (!await copyWithFeedback([item.title, date, time, item.description].filter(Boolean).join('\n'), 'Activity copied.')) return;
    setOpenMenu(null);
  };

  const calendarDays = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, index) => index + 1)];
  }, [month]);

  const openNew = (date = todayKey()) => {
    setSaveError('');
    setShowTime(false);
    setShowDescription(false);
    setEditor({ item: { id: generateUUID(), title: '', activityDate: date, activityTime: '', description: '' }, isNew: true });
  };

  const showActivitiesForDate = (date: string) => {
    setSelectedDate(date);
    if (overlaysByDate.has(date)) { setDateDetails(date); return; }
    const matches = filteredItems.filter(item => item.activityDate === date);
    const first = matches[0];
    if (!first) return;
    const card = document.getElementById(`activity-card-${first.id}`);
    if (card) scrollActivityBelowHeader(card, document.querySelector<HTMLElement>('[data-app-header]'), window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    highlightActivityCards(matches.map(item => document.getElementById(`activity-card-${item.id}`)).filter((element): element is HTMLElement => !!element), window.matchMedia('(prefers-reduced-motion: reduce)').matches);
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
      setSelectedDate(saved.activityDate);
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
    if (!(await confirmAction(`Delete “${item.title}”?`))) return;
    try {
      await deleteActivity(item.id);
      setItems(previous => previous.filter(existing => existing.id !== item.id));
    } catch (error) {
      console.error('Failed to delete activity:', error);
      setLoadError('Could not delete activity.');
    }
  };

  return <div className="relative space-y-4 pb-16" onClick={() => setOpenMenu(null)}>
    <section ref={calendarRef} data-no-swipe aria-label="Activity calendar" className="touch-pan-y rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900">
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
          const entries = overlaysByDate.get(key) || [];
          const kinds = ['ph', 'local', 'birthday'] as const;
          const extraLabel = kinds.map(kind => { const total = entries.filter(entry => entry.kind === kind).length; return total ? `, ${total} ${kind === 'birthday' ? 'birthday' : kind === 'local' ? 'local holiday' : 'PH holiday'}${total > 1 ? 's' : ''}` : ''; }).join('');
          const isSelected = key === selectedDate;
          const isCurrentDay = key === today;
          return <button key={key} aria-current={isCurrentDay ? 'date' : undefined} type="button" onClick={() => showActivitiesForDate(key)} className="flex min-h-11 flex-col items-center justify-center rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-slate-800" aria-label={`${key}${count ? `, ${count} ${count === 1 ? 'activity' : 'activities'}` : ''}${extraLabel}`}>
            <span className={`flex h-8 w-8 items-center justify-center rounded-full ${isCurrentDay ? 'bg-indigo-600 text-white dark:bg-indigo-300 dark:text-slate-950 font-bold' : isSelected ? 'bg-indigo-100 font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200' : ''}`}>{day}</span>
            <span className="flex h-2 items-center justify-center gap-0.5" aria-hidden="true">{Array.from({ length: Math.min(count, 3) }, (_, dot) => <i key={dot} className="h-1 w-1 rounded-full bg-amber-500" />)}{kinds.filter(kind => entries.some(entry => entry.kind === kind)).map(kind => <i key={kind} data-calendar-overlay={kind} className={`h-1 w-1 rounded-full ${kind === 'ph' ? 'bg-cyan-500' : kind === 'local' ? 'bg-violet-500' : 'bg-rose-500'}`} />)}</span>
          </button>;
        })}
      </div>
    </section>

    {birthdaysLoading && overlayFilters.birthday && <p role="status" className="px-1 text-sm text-slate-500">Loading birthdays…</p>}
    <BottomSheet open={!!dateDetails} title={dateDetails ? localDate(dateDetails).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''} onClose={() => setDateDetails(null)}>
      <div className="divide-y divide-slate-200 dark:divide-slate-700">
        {(overlaysByDate.get(dateDetails || '') || []).map(entry => <div key={entry.id} className="flex gap-3 py-3"><i aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${entry.kind === 'ph' ? 'bg-cyan-500' : entry.kind === 'local' ? 'bg-violet-500' : 'bg-rose-500'}`} /><div className="min-w-0"><p className="font-semibold">{entry.title}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{entry.detail}{entry.kind === 'ph' ? ' · Philippines' : ''}</p>{entry.source && <a href={entry.source} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-blue-600 dark:text-blue-400">Official source</a>}</div></div>)}
        {filteredItems.filter(item => item.activityDate === dateDetails).map(item => <button type="button" key={item.id} className="flex w-full gap-3 py-3 text-left" onClick={() => { setDateDetails(null); const card = document.getElementById(`activity-card-${item.id}`); if (card) scrollActivityBelowHeader(card, document.querySelector<HTMLElement>('[data-app-header]'), true); }}><i aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" /><span className="font-semibold">{item.title}</span></button>)}
      </div>
    </BottomSheet>
    <div ref={resultsRef} data-activity-results>
    {loadError && <p role="alert" className="px-1 text-sm text-rose-600 dark:text-rose-400">{loadError}</p>}
    {loading ? <p role="status" className="py-8 text-center text-sm text-slate-500">Loading…</p> : filteredItems.length === 0 ? <div className="py-8 text-center"><CalendarDays className="mx-auto h-6 w-6 text-slate-400" /><p className="mt-2 text-sm text-slate-500">{search ? 'No matching activities.' : 'No activities yet.'}</p></div> : <div className="space-y-3">
      {yearList(activityGroups, group => group.items[0]?.activityDate, groups => groups.map(group => {

        const color = 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800';
        return <section key={group.key} className="space-y-2">
          <div className="flex items-center gap-3 px-1 pt-2"><span className="text-sm font-bold">{group.label}</span><span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" /></div>
          <div className="activity-agenda-group">{group.items.map(item => { const date = localDate(item.activityDate); const expanded = expandedActivity === item.id; const past = isPastActivity(item.activityDate, today); return <article id={`activity-card-${item.id}`} key={item.id} data-past={past || undefined} data-special-activity={!isRoutineActivity(item.title) || undefined} onClick={() => setExpandedActivity(expanded ? null : item.id)} className={`activity-agenda-row app-date-card relative scroll-mt-4 rounded-2xl border px-3 py-2.5 text-slate-800 dark:text-slate-200 ${color} ${openMenu === item.id ? 'z-30' : 'z-0'}`}>
            <div data-activity-card-header className="flex min-h-11 items-center gap-3">
              <CardDate date={item.activityDate} />
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><h3 className="app-card-title min-w-0 break-words text-sm font-semibold">{item.title}</h3><UpcomingBadge status={!past && (item.id === nextActivityId || item.id === followingActivityId) ? item.activityDate === today ? 'today' : item.id === nextActivityId ? 'next-up' : 'upcoming' : undefined} /></div>{item.activityTime && <p className="app-card-secondary mt-1 flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400"><Clock className="h-3 w-3" />{new Date(`2000-01-01T${item.activityTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>}</div>
              <div className="relative" data-activity-actions={item.id}><button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl" aria-label={`Actions for ${item.title}`} aria-expanded={openMenu === item.id} onClick={event => { event.stopPropagation(); setOpenMenu(openMenu === item.id ? null : item.id); }}><MoreHorizontal className="h-4 w-4" /></button>{openMenu === item.id && <div className="absolute right-0 top-10 z-20 w-36 rounded-xl border border-slate-200 bg-white p-1 text-slate-900 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-white" onClick={event => event.stopPropagation()}><button type="button" className={`${action} w-full justify-start`} onClick={() => void copyActivity(item)}><Copy className="h-4 w-4" />Copy</button>{canEdit && <button type="button" className={`${action} w-full justify-start`} onClick={() => { setSaveError(''); setShowTime(Boolean(item.activityTime)); setShowDescription(Boolean(item.description)); setEditor({ item: { ...item }, isNew: false }); setOpenMenu(null); }}><Pencil className="h-4 w-4" />Edit</button>}{canDelete && <button type="button" className={`${action} w-full justify-start text-rose-600`} onClick={() => void remove(item)}><Trash2 className="h-4 w-4" />Delete</button>}</div>}</div>
            </div>
            {expanded && item.description && <p className="mt-2 whitespace-pre-wrap break-words border-t border-slate-200 dark:border-slate-700 pt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{item.description}</p>}
          </article>; })}</div>
        </section>;
      }), { reveal: !!search.trim(), currentYear: Number(today.slice(0, 4)), gridClass: 'space-y-3 px-3 pb-3' })}
    </div>}
    </div>

    {canAdd && <button type="button" aria-label="Add activity" title="Add activity" className="app-fab fixed bottom-20 sm:bottom-22 right-4 sm:right-6 md:right-8 z-30 w-14 h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-95 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 shadow-xl shadow-slate-900/30 dark:shadow-black/50 border border-slate-700/20 dark:border-slate-200/30 flex items-center justify-center transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white focus:ring-offset-2" onClick={() => openNew()}><Plus className="w-6 h-6 stroke-[2.5]" /></button>}

    {editor && <div role="dialog" aria-modal="true" aria-labelledby="activity-editor-title" className="ui-viewport-screen fixed inset-0 z-50 flex flex-col overflow-hidden bg-white dark:bg-slate-950 sm:items-center sm:justify-center sm:bg-black/50 sm:p-4">
      <form onSubmit={submit} autoComplete="off" data-form-type="other" className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white dark:bg-slate-950 sm:h-auto sm:max-h-[92dvh] sm:max-w-md sm:rounded-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800"><h2 id="activity-editor-title" className="font-semibold">{editor.isNew ? 'New activity' : 'Edit activity'}</h2><button type="button" disabled={saving} className="flex h-10 w-10 items-center justify-center rounded-xl" aria-label="Close" onClick={() => setEditor(null)}><X className="h-5 w-5" /></button></header>
        <fieldset disabled={saving} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <label className="block text-sm font-medium">Title<input required autoFocus id="activity-title" name="activity_title" autoComplete="off" autoCorrect="off" autoCapitalize="sentences" spellCheck={false} data-form-type="other" data-lpignore="true" className={`${field} mt-1.5`} value={editor.item.title} onChange={event => setEditor({ ...editor, item: { ...editor.item, title: event.target.value } })} /></label>
          <label className="block text-sm font-medium">Date<SheetDateField required id="activity-date" name="activity_date" type="date" autoComplete="off" data-form-type="other" data-lpignore="true" className={`${field} mt-1.5`} value={editor.item.activityDate} onChange={event => setEditor({ ...editor, item: { ...editor.item, activityDate: event.target.value } })} /></label>
          <div>{!showTime ? <button type="button" className="text-left text-sm font-semibold text-indigo-600" onClick={() => setShowTime(true)}>+ Add time</button> : <label className="block text-sm font-medium">Time <span className="font-normal text-slate-400">(optional)</span><SheetDateField id="activity-time" name="activity_time" type="time" autoComplete="off" data-form-type="other" data-lpignore="true" className={`${field} mt-1.5`} value={editor.item.activityTime || ''} onChange={event => setEditor({ ...editor, item: { ...editor.item, activityTime: event.target.value } })} /></label>}</div>
          <div className="pt-3">{!showDescription ? <button type="button" className="text-left text-sm font-semibold text-indigo-600" onClick={() => setShowDescription(true)}>+ Add description</button> : <label className="block text-sm font-medium">Description <span className="font-normal text-slate-400">(optional)</span><textarea id="activity-description" name="activity_description" rows={4} className={`${field} mt-1.5 resize-none`} value={editor.item.description || ''} onChange={event => setEditor({ ...editor, item: { ...editor.item, description: event.target.value } })} /></label>}</div>
          {saveError && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{saveError}</p>}
        </fieldset>
        <footer className="relative z-10 flex items-center gap-3 shrink-0 border-t border-slate-200 bg-white p-3 pb-[calc(0.75rem+var(--app-safe-bottom))] dark:border-slate-800 dark:bg-slate-950"><button type="button" disabled={saving} className="min-h-12 rounded-xl border border-slate-300 dark:border-slate-700 px-4 font-semibold" onClick={() => setEditor(null)}>Cancel</button><button type="submit" disabled={saving || !editor.item.title.trim() || !editor.item.activityDate} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? 'Saving…' : 'Save'}</button></footer>
      </form>
    </div>}
  </div>;
}
