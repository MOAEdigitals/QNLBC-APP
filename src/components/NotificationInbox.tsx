import React, { useState } from 'react';
import { X, Bell, RefreshCw } from 'lucide-react';
import { useBackLayer } from '../hooks/useBackLayer';
import { markAssignmentNotificationRead, type AssignmentNotification, type PushStatus } from '../services/assignmentNotifications';
interface Props { items: AssignmentNotification[]; loading: boolean; error: string; pushStatus: PushStatus; onEnable: () => Promise<void>; onRefresh: () => Promise<void>; onOpen: (id: string) => void; onClose: () => void }
export function NotificationInbox({ items, loading, error, pushStatus, onEnable, onRefresh, onOpen, onClose }: Props) {
  const [opening, setOpening] = useState<string | null>(null);
  const [readError, setReadError] = useState('');
  useBackLayer(true, onClose);
  const open = async (item: AssignmentNotification) => {
    setOpening(item.id); setReadError('');
    try { await markAssignmentNotificationRead(item.id); await onRefresh(); onOpen(item.setlist_id); onClose(); }
    catch (e) { setReadError((e as Error).message); }
    finally { setOpening(null); }
  };
  return <div role="dialog" aria-modal="true" aria-labelledby="notifications-title" className="ui-viewport-screen fixed inset-0 z-[190] bg-white dark:bg-slate-950 flex flex-col" style={{ paddingTop: 'var(--app-safe-top)', paddingBottom: 'var(--app-safe-bottom)' }}>
    <header className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 p-4">
      <h2 id="notifications-title" className="flex items-center gap-2 text-lg font-semibold"><Bell className="h-5 w-5" />Notifications</h2>
      <div className="flex"><button type="button" aria-label="Refresh notifications" className="h-11 w-11 grid place-items-center" disabled={loading} onClick={() => void onRefresh()}><RefreshCw className="h-5 w-5" /></button><button type="button" aria-label="Close notifications" className="h-11 w-11 grid place-items-center" onClick={onClose}><X className="h-5 w-5" /></button></div>
    </header>
    <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
      <p className="text-sm text-slate-500">Assignment updates and practice reminders every Saturday at 9 AM Philippine time.</p>
      {pushStatus !== 'web' && pushStatus !== 'enabled' && <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700 text-sm space-y-2">
        <p>{pushStatus === 'setup' ? 'Android push notifications are not available in this build.' : pushStatus === 'denied' ? 'Notifications are blocked. Allow notifications for QNLBC App in Android Settings.' : pushStatus === 'error' ? 'Could not enable Android notifications. Please try again.' : 'Receive assignment notifications even when the app is closed.'}</p>
        {pushStatus !== 'setup' && <button type="button" className="ui-primary" onClick={() => void onEnable()}>Enable notifications</button>}
      </div>}
      {(error || readError) && <p role="alert" className="text-sm text-rose-600">{error || readError}</p>}
      {loading && !items.length ? <p role="status">Loading notifications…</p> : !error && !items.length ? <p className="py-8 text-center text-slate-500">No notifications yet.</p> : <div className="space-y-2">{items.map(item => <button type="button" key={item.id} disabled={!!opening} onClick={() => void open(item)} className={`w-full rounded-xl border p-4 text-left space-y-1 ${item.read_at ? 'border-slate-200 dark:border-slate-800' : 'border-indigo-300 bg-indigo-50 dark:bg-indigo-950/30'}`}>
        <p className="font-semibold">{!item.read_at && <span className="sr-only">Unread: </span>}{item.title}</p><p className="text-sm">{item.body}</p><p className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</p>
      </button>)}</div>}
    </div>
  </div>;
}
