import { supabase, isSupabaseConfigured } from '../../supabase';
import { sermonPayload } from './model';
import type { SermonOutline, SermonInput } from './model';

function readableError(error: { code?: string; message?: string }): Error {
  if (error.code === 'PGRST205' || error.code === '42P01') return new Error('Sermon sharing needs database setup. Ask an admin to run the sermon outlines setup SQL in Supabase.');
  return new Error(error.message || 'Unable to access sermon outlines. Please try again.');
}
export async function loadSermons(): Promise<SermonOutline[]> {
  if (!isSupabaseConfigured()) throw new Error('The shared database is not configured.');
  const { data, error } = await supabase.from('sermon_outlines').select('*').order('service_date');
  if (error) throw readableError(error);
  return data as SermonOutline[];
}
export async function saveSermon(input: SermonInput, authorId: string, existing?: SermonOutline, newId?: string): Promise<SermonOutline> {
  const payload = sermonPayload(input);
  // A stable UUID makes retry safe if a successful insert response is lost.
  if (!existing && newId) {
    const prior = await supabase.from('sermon_outlines').select('*').eq('id', newId).maybeSingle();
    if (prior.error) throw readableError(prior.error);
    if (prior.data) {
      if (prior.data.author_id !== authorId) throw new Error('This outline belongs to another author.');
      existing = prior.data as SermonOutline;
    }
  }
  const query = existing
    ? supabase.from('sermon_outlines').update(payload).eq('id', existing.id).eq('revision', existing.revision)
    : supabase.from('sermon_outlines').insert({ ...payload, id: newId, author_id: authorId });
  const { data, error } = await query.select('*').maybeSingle();
  if (error) throw readableError(error);
  if (!data) throw new Error('This sermon changed on another device. Your text is still here. Close the editor and refresh before editing again.');
  return data as SermonOutline;
}
