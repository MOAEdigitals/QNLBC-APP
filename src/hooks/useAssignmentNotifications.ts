import { useCallback, useEffect, useRef, useState } from 'react';
import { App as NativeApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../supabase';
import { hasNewUnreadNotifications, notificationSoundEnabled, playNotificationSound, unlockNotificationSound } from '../utils/notificationSound';
import { fetchAssignmentNotifications, fetchUnreadNotificationCount, markNotificationsRead, listenForAssignmentPush, enableAssignmentPush, refreshAssignmentPushPermission, type AssignmentNotification, type PushStatus } from '../services/assignmentNotifications';
export function useAssignmentNotifications(userId: string | undefined, onOpen: (id: string) => void, onAnnouncement?: () => void, onCalendar?: (kind: 'birthday' | 'event') => void) {
  const [items, setItems] = useState<AssignmentNotification[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushStatus, setPushStatus] = useState<PushStatus>('prompt');
  const epoch = useRef(0);
  const refreshSequence = useRef(0);
  const seen = useRef<Set<string> | null>(null);
  const startedAt = useRef(Date.now());
  const refresh = useCallback(async () => {
    if (!userId) return;
    const own = epoch.current;
    const sequence = ++refreshSequence.current;
    setLoading(true);
    try { const [rows, count] = await Promise.all([fetchAssignmentNotifications(), fetchUnreadNotificationCount()]); if (own === epoch.current && sequence === refreshSequence.current) {
      const ownRows = rows.filter(item => item.user_id === userId);
      if (hasNewUnreadNotifications(ownRows, seen.current, startedAt.current)) void playNotificationSound(userId).catch(() => {});
      const nextSeen = seen.current || new Set<string>();
      ownRows.forEach(item => nextSeen.add(item.id)); seen.current = nextSeen;
      setItems(ownRows); setUnreadCount(count); setError('');
    } }
    catch (e) { if (own === epoch.current && sequence === refreshSequence.current) setError((e as Error).message); }
    finally { if (own === epoch.current && sequence === refreshSequence.current) setLoading(false); }
  }, [userId]);
  useEffect(() => {
    epoch.current++;
    seen.current = null; startedAt.current = Date.now();
    setItems([]); setUnreadCount(0); setError('');
    if (!userId) return;
    let disposed = false;
    let stopPush: (() => void) | undefined;
    void refresh();
    const channel = supabase.channel(`notification-sound-${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'assignment_notifications', filter: `user_id=eq.${userId}` }, () => void refresh()).subscribe();
    const unlock = () => { if (notificationSoundEnabled(userId)) void unlockNotificationSound(); };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    void listenForAssignmentPush(userId, onOpen, () => void refresh(), status => { if (!disposed) setPushStatus(status); }, onAnnouncement, onCalendar).then(stop => { if (disposed) stop(); else stopPush = stop; });
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 60000);
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', visible);
    const native = Capacitor.isNativePlatform() ? NativeApp.addListener('appStateChange', state => { if (state.isActive) { void refresh(); void refreshAssignmentPushPermission().then(status => { if (!disposed && status) setPushStatus(status); }).catch(() => { if (!disposed) setPushStatus('error'); }); } }) : null;
    return () => { disposed = true; epoch.current++; stopPush?.(); void supabase.removeChannel(channel); clearInterval(timer); document.removeEventListener('visibilitychange', visible); document.removeEventListener('pointerdown', unlock); document.removeEventListener('keydown', unlock); if (native) void native.then(handle => handle.remove()); };
  }, [userId, onOpen, onAnnouncement, onCalendar, refresh]);
  const enable = async () => { try { const status = await enableAssignmentPush(); if (status !== 'prompt') setPushStatus(status); } catch { setPushStatus('error'); } };
  const markRead = useCallback(async (ids?: string[]) => {
    const own = epoch.current;
    await markNotificationsRead(ids);
    if (own !== epoch.current) return;
    setItems(rows => rows.map(item => !ids || ids.includes(item.id) ? { ...item, read_at: item.read_at || new Date().toISOString() } : item));
    await refresh();
  }, [refresh]);
  return { items: items.filter(item => item.user_id === userId), unreadCount, markRead, error, loading, refresh, pushStatus, enable };
}
