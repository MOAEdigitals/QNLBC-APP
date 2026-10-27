import React, { useEffect, useRef, useState } from 'react';
import { X, Bell, RefreshCw, Trash2 } from 'lucide-react';
import { useBackLayer } from '../hooks/useBackLayer';
import { dismissNotification, markAssignmentNotificationRead, type AssignmentNotification, type PushStatus } from '../services/assignmentNotifications';
interface Props { items: AssignmentNotification[]; loading: boolean; error: string; pushStatus: PushStatus; markRead: (ids: string[]) => Promise<void>; onEnable: () => Promise<void>; onRefresh: () => Promise<void>; onOpen: (id: string) => void; onCalendar?: (kind: 'birthday' | 'event') => void; onClose: () => void }
export function NotificationInbox({ items, loading, error, pushStatus, markRead, onEnable, onRefresh, onOpen, onCalendar, onClose }: Props) {
  const [opening, setOpening] = useState<string | null>(null);
  const [readError, setReadError] = useState('');
  const [hidden, setHidden] = useState<string[]>([]), [deleted, setDeleted] = useState<AssignmentNotification | null>(null);
  const deleting = useRef(false);
  const visible = items.filter(item => !hidden.includes(item.id));
  const unreadIds = visible.filter(item => !item.read_at).map(item => item.id).sort().join(',');
  useEffect(() => {
    if (loading || error || !unreadIds) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      if (document.visibilityState === 'visible') timer = setTimeout(() => { void markRead(unreadIds.split(',')).catch(error => setReadError((error as Error).message)); }, 5000);
    };
    schedule(); document.addEventListener('visibilitychange', schedule);
    return () => { if (timer) clearTimeout(timer); document.removeEventListener('visibilitychange', schedule); };
  }, [unreadIds, loading, error, markRead]);
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
  const open = async (item: AssignmentNotification) => {
    setOpening(item.id); setReadError('');
    try { await markAssignmentNotificationRead(item.id); await onRefresh(); if (item.setlist_id) { onOpen(item.setlist_id); onClose(); } else if (item.kind === 'birthday' || item.kind === 'event') { onCalendar?.(item.kind); onClose(); } }
    catch (e) { setReadError((e as Error).message); }
    finally { setOpening(null); }
  };
  return <div role="dialog" aria-modal="true" aria-labelledby="notifications-title" className="ui-viewport-screen fixed inset-0 z-[190] bg-white dark:bg-slate-950 flex flex-col" style={{ paddingTop: 'var(--app-safe-top)', paddingBottom: 'var(--app-safe-bottom)' }}>
    <header className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 p-4">
      <h2 id="notifications-title" className="flex items-center gap-2 text-lg font-semibold"><Bell className="h-5 w-5" />Notifications</h2>
      <div className="flex"><button type="button" aria-label="Refresh notifications" className="h-11 w-11 grid place-items-center" disabled={loading} onClick={() => void onRefresh()}><RefreshCw className="h-5 w-5" /></button><button type="button" aria-label="Close notifications" className="h-11 w-11 grid place-items-center" onClick={onClose}><X className="h-5 w-5" /></button></div>
    </header>
    <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
      <p className="text-sm text-slate-500">Church announcements, assignments, birthdays, and event reminders. Swipe a card to delete it from your notifications.</p>
      {deleted && <div role="status" className="flex items-center justify-between rounded-xl bg-slate-100 dark:bg-slate-800 p-3 text-sm"><span>Notification deleted.</span><button className="min-h-11 px-3 font-semibold underline" disabled={!!opening} onClick={() => void remove(deleted, true)}>Undo</button></div>}
      {pushStatus !== 'web' && pushStatus !== 'enabled' && <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700 text-sm space-y-2">
        <p>{pushStatus === 'setup' ? 'Android push notifications are not available in this build.' : pushStatus === 'denied' ? 'Notifications are blocked. Allow notifications for QNLBC Team in Android Settings.' : pushStatus === 'error' ? 'Could not enable Android notifications. Please try again.' : 'Receive church notifications even when the app is closed.'}</p>
        {pushStatus !== 'setup' && <button type="button" className="ui-primary" onClick={() => void onEnable()}>Enable notifications</button>}
      </div>}
      {(error || readError) && <p role="alert" className="text-sm text-rose-600">{error || readError}</p>}
      {loading && !visible.length ? <p role="status">Loading notifications…</p> : !error && !visible.length ? <p className="py-8 text-center text-slate-500">No notifications yet.</p> : <div className="space-y-2">{visible.map(item => <SwipeNotification key={item.id} disabled={!!opening} label={item.title} onDelete={() => void remove(item)} onOpen={() => void open(item)} unread={!item.read_at}>
        <p className="font-semibold">{!item.read_at && <span className="sr-only">Unread: </span>}{item.title}</p><p className="text-sm whitespace-pre-wrap break-words">{item.body}</p><p className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</p>
      </SwipeNotification>)}</div>}
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
    <button type="button" disabled={disabled} onClick={() => { if (!suppressClick.current) onOpen(); }} style={{ transform: `translateX(${offset}px)` }} className={`relative w-full rounded-xl border p-4 pr-14 text-left space-y-1 ${unread ? 'border-indigo-300 bg-indigo-50 dark:bg-indigo-950' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950'}`}>{children}</button>
    <button type="button" disabled={disabled} aria-label={`Delete notification: ${label}`} onClick={onDelete} className="absolute top-3 right-2 w-10 h-10 grid place-items-center rounded-lg text-slate-500 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-slate-800"><Trash2 className="w-4 h-4" /></button>
  </div>;
}
