import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { PushNotifications, type PermissionStatus } from '@capacitor/push-notifications';
import { supabase } from '../supabase';
export interface AssignmentNotification {
  id: string; user_id: string; setlist_id: string | null; kind: 'assigned' | 'updated' | 'removed' | 'practice' | 'announcement' | 'birthday' | 'event';
  title: string; body: string; service_date: string | null; read_at: string | null; created_at: string;
}
export type PushStatus = 'web' | 'setup' | 'prompt' | 'denied' | 'enabled' | 'error';
const android = () => Capacitor.getPlatform() === 'android';
const configured = () => import.meta.env.VITE_ANDROID_PUSH_CONFIGURED === 'true';
let generation = 0;
let registrationWork: Promise<void> = Promise.resolve();
let permissionWork: Promise<PermissionStatus> | undefined;
async function pushPermission(automatic: boolean): Promise<PermissionStatus> {
  if (permissionWork) return permissionWork;
  const permission = await PushNotifications.checkPermissions();
  if (permissionWork) return permissionWork;
  if (permission.receive !== 'prompt' && permission.receive !== 'prompt-with-rationale') return permission;
  if (automatic && localStorage.getItem('qnlbc_notification_permission_asked')) return permission;
  if (permissionWork) return permissionWork;
  localStorage.setItem('qnlbc_notification_permission_asked', '1');
  permissionWork = PushNotifications.requestPermissions();
  try { return await permissionWork; } finally { permissionWork = undefined; }
}
/** Ask on first Android launch; account registration waits for authenticated listeners. */
export async function requestInitialPushPermission(): Promise<PushStatus> {
  if (!android()) return 'web';
  if (!configured()) return 'setup';
  const permission = await pushPermission(true);
  return permission.receive === 'denied' ? 'denied' : 'prompt';
}
function installationId(): string {
  let id = localStorage.getItem('qnlbc_push_installation');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('qnlbc_push_installation', id); }
  return id;
}
export function notificationSetlist(data: unknown, userId: string): string | null {
  if (!data || typeof data !== 'object') return null;
  const value = data as Record<string, unknown>;
  return value.userId === userId && typeof value.setlistId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.setlistId) ? value.setlistId : null;
}
export function isAnnouncementPush(data: unknown, userId: string): boolean {
  if (!data || typeof data !== 'object') return false;
  const value = data as Record<string, unknown>;
  return value.userId === userId && value.kind === 'announcement' && typeof value.notificationId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.notificationId);
}
export function calendarPushKind(data: unknown, userId: string): 'birthday' | 'event' | null {
  if (!data || typeof data !== 'object') return null;
  const value = data as Record<string, unknown>;
  return value.userId === userId && typeof value.notificationId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.notificationId)
    && (value.kind === 'birthday' || value.kind === 'event') ? value.kind : null;
}
export async function dismissNotification(id: string, dismissed = true): Promise<void> {
  const { error } = await supabase.rpc('set_notification_dismissed', { notification_id: id, dismissed });
  if (error) throw new Error('Could not update this notification. Please try again.');
}
export async function fetchAssignmentNotifications(): Promise<AssignmentNotification[]> {
  const { data, error } = await supabase.from('assignment_notifications').select('*').is('dismissed_at', null).order('created_at', { ascending: false }).limit(100);
  if (error) throw new Error('Notifications could not be loaded. Please try again.');
  return data || [];
}
export async function markAssignmentNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.rpc('mark_assignment_notification_read', { notification_id: id });
  if (error) throw new Error('Could not mark notification as read.');
}
export async function enableAssignmentPush(): Promise<PushStatus> {
  if (!android()) return 'web';
  if (!configured()) return 'setup';
  const permission = await pushPermission(false);
  if (permission.receive !== 'granted') return 'denied';
  await PushNotifications.register();
  // 'enabled' is set only when the registration token has been persisted.
  return 'prompt';
}
export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase.rpc('mark_notifications_read', { notification_ids: ids.slice(0, 100) });
  if (error) throw new Error('Could not mark notifications as read. Please try again.');
}
export async function refreshAssignmentPushPermission(): Promise<PushStatus | undefined> {
  if (!android()) return 'web';
  if (!configured()) return 'setup';
  const permission = await PushNotifications.checkPermissions();
  if (permission.receive === 'granted') { await PushNotifications.register(); return undefined; }
  return permission.receive === 'denied' ? 'denied' : 'prompt';
}
export async function disableAssignmentPush(): Promise<void> {
  generation++;
  await registrationWork.catch(() => {});
  const id = localStorage.getItem('qnlbc_push_installation');
  const tasks: Promise<unknown>[] = [];
  if (id) tasks.push(Promise.resolve(supabase.rpc('unregister_push_device', { installation_id: id })).then(({ error }) => { if (error) throw error; }));
  if (android() && configured()) tasks.push(PushNotifications.unregister(), PushNotifications.removeAllDeliveredNotifications());
  const results = await Promise.allSettled(tasks);
  if (results.some(result => result.status === 'rejected')) throw new Error('Could not fully disconnect Android notifications.');
}
export async function listenForAssignmentPush(userId: string, onOpen: (id: string) => void, onRefresh: () => void, onStatus: (status: PushStatus) => void, onAnnouncement?: () => void, onCalendar?: (kind: 'birthday' | 'event') => void): Promise<() => void> {
  const ownGeneration = ++generation;
  let stopped = false;
  const handles: PluginListenerHandle[] = [];
  const live = () => !stopped && generation === ownGeneration;
  const stop = () => { stopped = true; handles.forEach(handle => void handle.remove()); };
  if (!android()) { onStatus('web'); return stop; }
  if (!configured()) { onStatus('setup'); return stop; }
  try {
    handles.push(await PushNotifications.addListener('registration', token => {
      registrationWork = registrationWork.catch(() => {}).then(async () => {
        if (!live()) return;
        const { data } = await supabase.auth.getUser();
        if (!live() || data.user?.id !== userId) return;
        const { error } = await supabase.rpc('register_push_device', { device_id: installationId(), registration_token: token.value });
        if (live()) onStatus(error ? 'error' : 'enabled');
      }).catch(() => { if (live()) onStatus('error'); });
    }));
    handles.push(await PushNotifications.addListener('registrationError', () => { if (live()) onStatus('error'); }));
    handles.push(await PushNotifications.addListener('pushNotificationReceived', notification => {
      if (live() && (notificationSetlist(notification.data, userId) || isAnnouncementPush(notification.data, userId) || calendarPushKind(notification.data, userId))) onRefresh();
    }));
    handles.push(await PushNotifications.addListener('pushNotificationActionPerformed', action => {
      if (!live()) return;
      const notificationId = action.notification.data?.notificationId;
      if (action.notification.data?.userId === userId && typeof notificationId === 'string') void markAssignmentNotificationRead(notificationId).then(onRefresh).catch(() => onRefresh());
      const id = notificationSetlist(action.notification.data, userId);
      if (id) { onRefresh(); onOpen(id); } else if (isAnnouncementPush(action.notification.data, userId)) { onRefresh(); onAnnouncement?.(); }
      else { const kind = calendarPushKind(action.notification.data, userId); if (kind) { onRefresh(); onCalendar?.(kind); } }
    }));
    if (!live()) { stop(); return stop; }
    await PushNotifications.createChannel({ id: 'church-alerts-v2', name: 'Church notifications', description: 'Assignments, announcements, birthdays and special events', importance: 4, sound: 'qnlbc_notification.wav', vibration: true });
    const permission = await pushPermission(true);
    if (!live()) { stop(); return stop; }
    if (permission.receive === 'granted') await PushNotifications.register();
    else if (live()) onStatus(permission.receive === 'denied' ? 'denied' : 'prompt');
  } catch { if (live()) onStatus('error'); }
  return stop;
}
