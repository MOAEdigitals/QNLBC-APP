import { notificationCopy, notificationDone } from '../utils/notificationPresentation';
import { useLiveClock } from '../hooks/useLiveClock';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Award, Bell, Calendar, CalendarDays, Cake, Heart, Megaphone, RefreshCw, Trash2, MoreHorizontal, CheckCheck, X, Music } from 'lucide-react';
import { useBackLayer } from '../hooks/useBackLayer';
import { dismissNotification, type AssignmentNotification, type PushStatus } from '../services/assignmentNotifications';
interface Props { items: AssignmentNotification[]; unreadCount: number; loading: boolean; error: string; pushStatus: PushStatus; onComplete: (ids?: string[]) => Promise<void>; onEnable: () => Promise<void>; onRefresh: () => Promise<void>; onClose: () => void }
const manilaDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' });
const manilaTime = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
const manilaShortDate = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'long', month: 'short', day: 'numeric' });
const categories = {
  assigned: { label: 'Setlist', Icon: CalendarDays, color: 'bg-blue-600' },
  updated: { label: 'Setlist', Icon: CalendarDays, color: 'bg-blue-600' },
  removed: { label: 'Setlist', Icon: CalendarDays, color: 'bg-blue-600' },
  practice: { label: 'Setlist reminder', Icon: CalendarDays, color: 'bg-blue-600' },
  backup_setlist: { label: 'Setlist', Icon: CalendarDays, color: 'bg-blue-600' },
  announcement: { label: 'Announcement', Icon: Megaphone, color: 'bg-violet-600' },
  birthday: { label: 'Birthday', Icon: Cake, color: 'bg-pink-600' },
  event: { label: 'Activities', Icon: Calendar, color: 'bg-cyan-700' },
  anniversary: { label: 'Anniversary', Icon: Heart, color: 'bg-rose-600' },
  recognition: { label: 'Achievement', Icon: Award, color: 'bg-amber-600' },
  missing_lyrics: { label: 'Song Numbers', Icon: Music, color: 'bg-orange-600' },
};

export function NotificationInbox({ items, unreadCount, loading, error, pushStatus, onComplete, onEnable, onRefresh, onClose }: Props) {
  const clock = useLiveClock();
  const now = new Date(clock);
  const [opening, setOpening] = useState<string | null>(null);
  const [readError, setReadError] = useState('');
  const [hidden, setHidden] = useState<string[]>([]);
  const [deleted, setDeleted] = useState<string[]>([]);
  useEffect(() => {
    if (!deleted.length) return;
    const timeout = window.setTimeout(() => setDeleted([]), 2000);
    return () => window.clearTimeout(timeout);
  }, [deleted]);
  const deleting = useRef(false);
  const visible = items.filter(item => !hidden.includes(item.id));
  const today = manilaDate.format(now);
  const yesterday = manilaDate.format(now.getTime() - 86_400_000);
  const groups = new Map<string, AssignmentNotification[]>();
  for (const item of visible.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))) {
    const day = manilaDate.format(new Date(item.created_at));
    const group = groups.get(day);
    if (group) group.push(item);
    else groups.set(day, [item]);
  }
  const [menuOpen, setMenuOpen] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const outside = (event: Event) => { if (!menu.current?.contains(event.target as Node)) setMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('click', outside, true);
    window.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('click', outside, true); window.removeEventListener('keydown', escape); };
  }, [menuOpen]);
  const remove = async (ids: string[], undo = false) => {
    if (deleting.current || opening || markingAll) return;
    deleting.current = true; setOpening(ids[0]); setReadError('');
    try {
      const results = await Promise.allSettled(ids.map(id => dismissNotification(id, !undo)));
      const succeeded = ids.filter((_, index) => results[index].status === 'fulfilled');
      setHidden(previous => undo ? previous.filter(id => !succeeded.includes(id)) : [...previous, ...succeeded]);
      if (undo) setDeleted(ids.filter(id => !succeeded.includes(id)));
      else if (succeeded.length) setDeleted(succeeded);
      if (succeeded.length < ids.length) setReadError('Some notifications could not be updated. Please try again.');
      if (succeeded.length) void onRefresh().catch(e => setReadError((e as Error).message));
    } catch (e) { setReadError((e as Error).message); }
    finally { deleting.current = false; setOpening(null); }
  };
  useBackLayer(true, onClose);
  useBackLayer(menuOpen, () => setMenuOpen(false));
  const markAll = async () => {
    setMenuOpen(false); setMarkingAll(true); setReadError('');
    try { await onComplete(); }
    catch (e) { setReadError((e as Error).message); }
    finally { setMarkingAll(false); }
  };
  const open = async (item: AssignmentNotification) => {
    setOpening(item.id); setReadError('');
    try { if (!notificationDone(item,clock)) await onComplete([item.id]); }
    catch (e) { setReadError((e as Error).message); }
    finally { setOpening(null); }
  };
  return <div role="dialog" aria-modal="true" aria-labelledby="notifications-title" className="ui-viewport-screen fixed inset-0 z-[190] bg-white dark:bg-slate-950 flex flex-col" style={{ paddingTop: 'var(--app-safe-top)', paddingBottom: 'var(--app-safe-bottom)' }}>
    <header className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 p-4">
      <button type="button" aria-label="Close notifications" className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" onClick={onClose}><ArrowLeft className="h-5 w-5" /></button>
      <h2 id="notifications-title" className="min-w-0 flex-1 truncate text-xl font-bold">Notifications</h2>
      <div className="flex">
        <div className="relative" ref={menu}><button type="button" aria-label="Notification options" aria-haspopup="menu" aria-expanded={menuOpen} className="h-11 w-11 grid place-items-center" onClick={() => setMenuOpen(value => !value)}><MoreHorizontal className="h-5 w-5" /></button>
          {menuOpen && <div role="menu" aria-label="Notification options" className="absolute right-0 top-full z-10 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"><button type="button" role="menuitem" className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50" disabled={!visible.some(item => !notificationDone(item,clock)) || !!opening || markingAll} onClick={() => void markAll()}><CheckCheck className="h-4 w-4" />Mark all as done</button><button type="button" role="menuitem" className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800" disabled={loading} onClick={() => { setMenuOpen(false); void onRefresh(); }}><RefreshCw className="h-4 w-4" />Refresh</button></div>}
        </div>
      </div>
    </header>
    <div className="mx-auto w-full max-w-xl flex-1 min-h-0 overflow-y-auto p-4 space-y-3">

      {!!deleted.length && <div className="fixed inset-x-4 bottom-[calc(var(--app-safe-bottom)+1rem)] z-20 mx-auto flex max-w-xl items-center justify-between rounded-xl bg-slate-100 dark:bg-slate-800 px-3 text-sm shadow-md"><span role="status">{deleted.length === 1 ? 'Notification cleared.' : `${deleted.length} notifications cleared.`}</span><button type="button" className="min-h-11 px-3 font-semibold text-blue-700 dark:text-blue-300" disabled={!!opening || markingAll} onClick={() => void remove(deleted, true)}>Undo</button></div>}
      {pushStatus !== 'web' && pushStatus !== 'enabled' && <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700 text-sm space-y-2">
        <p>{pushStatus === 'setup' ? 'Android push notifications are not available in this build.' : pushStatus === 'denied' ? 'Notifications are blocked. Allow notifications for QNLBC App in Android Settings.' : pushStatus === 'error' ? 'Could not enable Android notifications. Please try again.' : 'Receive church notifications even when the app is closed.'}</p>
        {pushStatus !== 'setup' && <button type="button" className="ui-primary" onClick={() => void onEnable()}>Enable notifications</button>}
      </div>}
      {(error || readError) && <p role="alert" className="text-sm text-rose-600">{error || readError}</p>}
      {loading && !visible.length ? <p role="status">Loading notifications…</p> : !error && !visible.length ? <div className="grid justify-items-center gap-3 py-14 text-slate-500 dark:text-slate-400"><Bell className="h-7 w-7" aria-hidden="true" /><p>No notifications yet.</p></div> : <div className="space-y-4">
        {Array.from(groups, ([day, group]) => {
          const label = day === today ? 'Today' : day === yesterday ? 'Yesterday' : manilaShortDate.format(new Date(group[0].created_at));
          return <section key={day} aria-labelledby={`notification-day-${day}`} className="space-y-2">
            <div className="flex items-center justify-between pl-1">
              <h3 id={`notification-day-${day}`} className="text-lg font-semibold">{label}</h3>
              <button type="button" aria-label={`Clear notifications for ${label}`} disabled={!!opening || markingAll} onClick={() => void remove(group.map(item => item.id))} className="grid h-11 w-11 place-items-center rounded-full text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800">
                <span className="grid size-6 place-items-center rounded-full bg-slate-100 dark:bg-slate-800"><X className="size-3.5" aria-hidden="true" /></span>
              </button>
            </div>
            {group.map(item => {
              const { label: category, Icon, color } = categories[item.kind] ?? categories.recognition;
              const done = notificationDone(item, clock);
              const unread = !item.read_at && !done;
              const copy = notificationCopy(item, now);
              const preview = copy.body;
              return <SwipeNotification key={item.id} disabled={!!opening || markingAll} label={copy.title} onDelete={() => void remove([item.id])} onOpen={() => void open(item)} unread={unread}>
                <span className="flex items-center gap-2 border-b border-slate-900/5 bg-slate-100/80 px-3 py-2.5 text-xs text-slate-600 dark:border-white/5 dark:bg-white/5 dark:text-slate-300">
                  <span className={`grid size-6 shrink-0 place-items-center rounded-lg text-white ${color}`}><Icon className="size-3.5" aria-hidden="true" /></span>
                  <span className="flex-1 font-medium">{category}</span>
                  {done && <span className="text-xs text-slate-500 dark:text-slate-400">Done</span>}
                  <time dateTime={item.created_at} className="shrink-0 tabular-nums">{manilaTime.format(new Date(item.created_at))}</time>
                </span>
                <span className={`relative block py-3 pl-7 pr-12 ${done ? 'text-slate-500 dark:text-slate-400' : ''}`}>
                  {unread && <><span aria-hidden="true" className="absolute left-3 top-4 size-2 rounded-full bg-blue-500" /><span className="sr-only">Unread: </span></>}
                  <span className={`block break-words text-sm ${copy.emphasis ? 'font-normal' : 'font-semibold'}`}>{copy.emphasis && copy.title.includes(copy.emphasis) ? <>{copy.title.slice(0,copy.title.indexOf(copy.emphasis))}<strong className="font-semibold">{copy.emphasis}</strong>{copy.title.slice(copy.title.indexOf(copy.emphasis)+copy.emphasis.length)}</> : copy.title}</span>
                  {preview && <span className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-600 dark:text-slate-300">{preview}</span>}
                </span>
              </SwipeNotification>;
            })}
          </section>;
        })}
      </div>}
    </div>
  </div>;
}

export function SwipeNotification({ children, label, disabled, onDelete, onOpen, unread }: { children: React.ReactNode; label: string; disabled: boolean; onDelete: () => void; onOpen: () => void; unread: boolean }) {
  const start = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null), suppressClick = useRef(false);
  const [offset, setOffset] = useState(0);
  return <div className="relative overflow-hidden rounded-xl bg-rose-600" style={{ touchAction: 'pan-y' }} onPointerDown={e => {
    suppressClick.current = false;
    if (disabled || !e.isPrimary || e.button !== 0 || e.clientX <= 32 || e.clientX >= window.innerWidth - 32) return;
    start.current = { x: e.clientX, y: e.clientY, dx: 0, dy: 0 };
  }} onPointerMove={e => {
    const p = start.current; if (!p) return;
    p.dx = e.clientX - p.x; p.dy = e.clientY - p.y;
    if (Math.abs(p.dy) > 12 && Math.abs(p.dy) > Math.abs(p.dx)) { start.current = null; setOffset(0); return; }
    if (Math.abs(p.dx) > 12 && Math.abs(p.dx) > Math.abs(p.dy) * 1.5) {
      suppressClick.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); setOffset(Math.max(-140, Math.min(140, p.dx)));
    }
  }} onPointerUp={e => {
    const p = start.current; start.current = null; setOffset(0);
    const dx = p ? e.clientX - p.x : 0, dy = p ? e.clientY - p.y : 0;
    if (p && !disabled && Math.abs(dx) >= 88 && Math.abs(dx) > Math.abs(dy) * 1.5) { suppressClick.current = true; onDelete(); }
  }} onPointerCancel={() => { start.current = null; setOffset(0); }}>
    <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-white text-sm">Delete</span>
    <button type="button" disabled={disabled} onClick={() => { if (!suppressClick.current) onOpen(); }} style={{ transform: `translateX(${offset}px)` }} className={`relative block w-full overflow-hidden rounded-xl border text-left ${offset === 0 ? 'motion-safe:transition-transform motion-safe:duration-150' : ''} ${unread ? 'border-blue-200 bg-blue-50 dark:border-blue-800/60 dark:bg-slate-900' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>{children}</button>
    <button type="button" disabled={disabled} aria-label={`Delete notification: ${label}`} onClick={onDelete} className="absolute bottom-1 right-1 w-10 h-10 grid place-items-center rounded-lg text-slate-500 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-slate-800"><Trash2 className="w-4 h-4" /></button>
  </div>;
}
