import { useCallback, useEffect, useRef, useState } from 'react';
import { App as NativeApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { fetchAssignmentNotifications, markNotificationsRead, listenForAssignmentPush, enableAssignmentPush, refreshAssignmentPushPermission, type AssignmentNotification, type PushStatus } from '../services/assignmentNotifications';
export function useAssignmentNotifications(userId: string | undefined, onOpen: (id: string) => void, onAnnouncement?: () => void, onCalendar?: (kind: 'birthday' | 'event') => void) {
  const [items, setItems] = useState<AssignmentNotification[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus>('prompt');
  const epoch = useRef(0);
  const refresh = useCallback(async () => {
    if (!userId) return;
    const own = epoch.current;
    setLoading(true);
    try { const rows = await fetchAssignmentNotifications(); if (own === epoch.current) { setItems(rows.filter(item => item.user_id === userId)); setError(''); } }
    catch (e) { if (own === epoch.current) setError((e as Error).message); }
    finally { if (own === epoch.current) setLoading(false); }
  }, [userId]);
  useEffect(() => {
    epoch.current++;
    setItems([]); setError('');
    if (!userId) return;
    let disposed = false;
    let stopPush: (() => void) | undefined;
    void refresh();
    void listenForAssignmentPush(userId, onOpen, () => void refresh(), status => { if (!disposed) setPushStatus(status); }, onAnnouncement, onCalendar).then(stop => { if (disposed) stop(); else stopPush = stop; });
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 60000);
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', visible);
    const native = Capacitor.isNativePlatform() ? NativeApp.addListener('appStateChange', state => { if (state.isActive) { void refresh(); void refreshAssignmentPushPermission().then(status => { if (!disposed && status) setPushStatus(status); }).catch(() => { if (!disposed) setPushStatus('error'); }); } }) : null;
    return () => { disposed = true; epoch.current++; stopPush?.(); clearInterval(timer); document.removeEventListener('visibilitychange', visible); if (native) void native.then(handle => handle.remove()); };
  }, [userId, onOpen, onAnnouncement, onCalendar, refresh]);
  const enable = async () => { try { const status = await enableAssignmentPush(); if (status !== 'prompt') setPushStatus(status); } catch { setPushStatus('error'); } };
  const markRead = useCallback(async (ids: string[]) => {
    const own = epoch.current;
    await markNotificationsRead(ids);
    if (own === epoch.current) setItems(rows => rows.map(row => ids.includes(row.id) ? { ...row, read_at: row.read_at || new Date().toISOString() } : row));
  }, [userId]);
  return { items: items.filter(item => item.user_id === userId), error, loading, refresh, pushStatus, enable, markRead };
}
