import { supabase } from '../supabase';
export interface AnnouncementRecipient { id: string; name: string; username: string; push_enabled: boolean }
export interface ScheduledAnnouncement { id: string; title: string; body: string; scheduled_at: string; state: 'pending' | 'sent' | 'cancelled'; recipient_count: number }
export interface AnnouncementHistory {
  id: string; title: string; body: string; created_at: string; sender_name: string;
  recipients: { id: string; name: string; username: string; read_at: string | null; status: 'accepted' | 'queued' | 'failed' | 'inbox_only' }[];
}
export async function loadAnnouncementAdmin(): Promise<{ recipients: AnnouncementRecipient[]; history: AnnouncementHistory[]; scheduled: ScheduledAnnouncement[] }> {
  const [people, messages, scheduled] = await Promise.all([supabase.rpc('list_announcement_recipients'), supabase.rpc('list_admin_announcements'), supabase.rpc('list_scheduled_announcements')]);
  if (people.error || messages.error || scheduled.error) throw new Error('Announcements could not be loaded. Please try again.');
  return { recipients: people.data || [], history: messages.data || [], scheduled: scheduled.data || [] };
}
export async function sendAnnouncement(id: string, title: string, body: string, recipients: string[], scheduledAt?: string): Promise<void> {
  const { error } = await supabase.rpc(scheduledAt ? 'schedule_admin_announcement' : 'send_admin_announcement', { request_id: id, message_title: title.trim(), message_body: body.trim(), recipient_ids: recipients, ...(scheduledAt ? { send_at: scheduledAt } : {}) });
  if (error) throw new Error(error.message || 'Could not send. Retry the same request to avoid duplicates.');
}
export async function cancelScheduledAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_scheduled_announcement', { request_id: id });
  if (error) throw new Error(error.message || 'Could not cancel this notification.');
}
