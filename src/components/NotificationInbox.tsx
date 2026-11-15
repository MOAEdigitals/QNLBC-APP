import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bell, RefreshCw, Trash2, MoreHorizontal, CheckCheck } from 'lucide-react';
import { useBackLayer } from '../hooks/useBackLayer';
import { dismissNotification, type AssignmentNotification, type PushStatus } from '../services/assignmentNotifications';
interface Props { items: AssignmentNotification[]; unreadCount: number; loading: boolean; error: string; pushStatus: PushStatus; onMarkRead: (ids?: string[]) => Promise<void>; onEnable: () => Promise<void>; onRefresh: () => Promise<void>; onOpen: (id: string) => void; onCalendar?: (kind: 'birthday' | 'event' | 'anniversary' | 'recognition') => void; onClose: () => void }
const manilaDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' });
const manilaTime = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
const manilaShortDate = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' });

function notificationBody(item: AssignmentNotification, now: Date) {
  if (item.kind === 'announcement') return item.body;
  const body = item.body.replace(/\s+Tap to view the setlist\.$/i, '');
  if (item.service_date !== manilaDate.format(now)) return body;
  return body.replace(/\btomorrow(?:,\s+\w+\s+\d{1,2}(?:,\s*\d{4})?)?/i, 'today').replace(/\bon\s+(?:(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)\w*,?\s+)?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}(?:,\s*\d{4})?\b/gi, 'today');
}

export function NotificationInbox({ items, unreadCount, loading, error, pushStatus, onMarkRead, onEnable, onRefresh, onOpen, onCalendar, onClose }: Props) {
  const now = new Date();
  const [detail, setDetail] = useState<AssignmentNotification | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [readError, setReadError] = useState('');
  const [hidden, setHidden] = useState<string[]>([]), [deleted, setDeleted] = useState<AssignmentNotification | null>(null);
  const deleting = useRef(false);
  const visible = items.filter(item => !hidden.includes(item.id));
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
  const remove = async (item: AssignmentNotification, undo = false) => {
    if (deleting.current) return;
    deleting.current = true; setOpening(item.id); setReadError('');
    try {
      await dismissNotification(item.id, !undo);
      setHidden(ids => undo ? ids.filter(id => id !== item.id) : [...ids, item.id]);
      setDeleted(undo ? null : item); await onRefresh();
    } catch (e) { setReadError((e as Error).message); }
    finally { deleting.current = false; setOpening(null); }
  };
  useBackLayer(true, onClose);
  useBackLayer(!!detail, () => setDetail(null));
  useBackLayer(menuOpen, () => setMenuOpen(false));
  const markAll = async () => {
    setMenuOpen(false); setMarkingAll(true); setReadError('');
    try { await onMarkRead(); }
    catch (e) { setReadError((e as Error).message); }
    finally { setMarkingAll(false); }
  };
  const open = async (item: AssignmentNotification) => {
    setOpening(item.id); setReadError('');
    try { await onMarkRead([item.id]); if (item.setlist_id) { onOpen(item.setlist_id); onClose(); } else if (item.kind === 'birthday' || item.kind === 'event' || item.kind === 'anniversary' || item.kind === 'recognition') { onCalendar?.(item.kind); onClose(); } else { setDetail(item); } }
    catch (e) { setReadError((e as Error).message); }
    finally { setOpening(null); }
  };
  return <div role="dialog" aria-modal="true" aria-labelledby="notifications-title" className="ui-viewport-screen fixed inset-0 z-[190] bg-white dark:bg-slate-950 flex flex-col" style={{ paddingTop: 'var(--app-safe-top)', paddingBottom: 'var(--app-safe-bottom)' }}>
    <header className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 p-4">
      <button type="button" aria-label={detail ? 'Back to notifications' : 'Close notifications'} className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => detail ? setDetail(null) : onClose()}><ArrowLeft className="h-5 w-5" /></button>
      <h2 id="notifications-title" className="min-w-0 flex-1 truncate text-xl font-bold">{detail ? detail.title : 'Notifications'}</h2>
      {!detail && <div className="flex">
        <div className="relative" ref={menu}><button type="button" aria-label="Notification options" aria-haspopup="menu" aria-expanded={menuOpen} className="h-11 w-11 grid place-items-center" onClick={() => setMenuOpen(value => !value)}><MoreHorizontal className="h-5 w-5" /></button>
          {menuOpen && <div role="menu" aria-label="Notification options" className="absolute right-0 top-full z-10 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"><button type="button" role="menuitem" className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50" disabled={!unreadCount || !!opening || markingAll} onClick={() => void markAll()}><CheckCheck className="h-4 w-4" />Mark all as read</button><button type="button" role="menuitem" className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800" disabled={loading} onClick={() => { setMenuOpen(false); void onRefresh(); }}><RefreshCw className="h-4 w-4" />Refresh</button></div>}
        </div>
      </div>}
    </header>
    {detail ? <article className="mx-auto w-full max-w-xl flex-1 overflow-y-auto whitespace-pre-wrap break-words p-5">{notificationBody(detail, now)}</article> : <div className="mx-auto w-full max-w-xl flex-1 min-h-0 overflow-y-auto p-4 space-y-3">

      {deleted && <div role="status" className="flex items-center justify-between rounded-xl bg-slate-100 dark:bg-slate-800 p-3 text-sm"><span>Notification deleted.</span><button className="min-h-11 px-3 font-semibold underline" disabled={!!opening} onClick={() => void remove(deleted, true)}>Undo</button></div>}
      {pushStatus !== 'web' && pushStatus !== 'enabled' && <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700 text-sm space-y-2">
        <p>{pushStatus === 'setup' ? 'Android push notifications are not available in this build.' : pushStatus === 'denied' ? 'Notifications are blocked. Allow notifications for QNLBC App in Android Settings.' : pushStatus === 'error' ? 'Could not enable Android notifications. Please try again.' : 'Receive church notifications even when the app is closed.'}</p>
        {pushStatus !== 'setup' && <button type="button" className="ui-primary" onClick={() => void onEnable()}>Enable notifications</button>}
      </div>}
      {(error || readError) && <p role="alert" className="text-sm text-rose-600">{error || readError}</p>}
      {loading && !visible.length ? <p role="status">Loading notifications…</p> : !error && !visible.length ? <div className="grid justify-items-center gap-3 py-14 text-slate-500 dark:text-slate-400"><Bell className="h-7 w-7" aria-hidden="true" /><p>No notifications yet.</p></div> : <div className="space-y-2">{visible.map(item => <SwipeNotification key={item.id} disabled={!!opening} label={item.title} onDelete={() => void remove(item)} onOpen={() => void open(item)} unread={!item.read_at}>
        <div className="flex min-w-0 items-start gap-2">
          <p className={`min-w-0 flex-1 break-words text-sm ${item.read_at ? 'font-medium' : 'font-semibold'}`}>{!item.read_at && <><span aria-hidden="true" className="mr-2 inline-block h-2 w-2 rounded-full bg-blue-500" /><span className="sr-only">Unread: </span></>}{item.title}</p>
          <time dateTime={item.created_at} className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{manilaDate.format(new Date(item.created_at)) === manilaDate.format(now) ? manilaTime.format(new Date(item.created_at)) : manilaShortDate.format(new Date(item.created_at))}</time>
        </div>
        <p className="line-clamp-2 break-words text-sm text-slate-600 dark:text-slate-300">{notificationBody(item, now)}</p>
      </SwipeNotification>)}</div>}
    </div>}
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
    <button type="button" disabled={disabled} onClick={() => { if (!suppressClick.current) onOpen(); }} style={{ transform: `translateX(${offset}px)` }} className={`relative w-full rounded-xl border p-3 pr-14 text-left space-y-1 ${offset === 0 ? 'motion-safe:transition-transform motion-safe:duration-150' : ''} ${unread ? 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-slate-800' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>{children}</button>
    <button type="button" disabled={disabled} aria-label={`Delete notification: ${label}`} onClick={onDelete} className="absolute top-3 right-2 w-10 h-10 grid place-items-center rounded-lg text-slate-500 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-slate-800"><Trash2 className="w-4 h-4" /></button>
  </div>;
}
