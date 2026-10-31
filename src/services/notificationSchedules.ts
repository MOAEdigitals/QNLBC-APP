import { supabase } from '../supabase';
export interface NotificationSchedule { kind: 'birthday' | 'event' | 'prayer' | 'sunday' | 'practice'; enabled: boolean; local_time: string; days_before: number; weekdays: number[] }
export async function loadNotificationSchedules(): Promise<NotificationSchedule[]> {
  const { data, error } = await supabase.from('notification_schedule_settings').select('*').order('kind');
  if (error) throw new Error('Notification schedules could not be loaded.');
  return data || [];
}
export async function saveNotificationSchedule(row: NotificationSchedule): Promise<void> {
  const { data, error } = await supabase.from('notification_schedule_settings').update({ enabled: row.enabled, local_time: row.local_time, days_before: row.days_before, weekdays: row.weekdays }).eq('kind', row.kind).select('kind');
  if (error || data?.length !== 1) throw new Error('Could not save this schedule. Administrator access is required.');
}
