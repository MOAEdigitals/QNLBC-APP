import { supabase } from '../../supabase';
import { latestRead, beginReadMutation } from '../../services/latestRead';
import { readAllPages } from '../../services/readAllPages';
export interface PersonalNote {
  id: string; user_id: string; title: string; body: string; revision: number;
  created_at: string; updated_at: string; deleted_at: string | null;
}
export async function loadNotes(userId: string): Promise<PersonalNote[]> {
  return latestRead(`notes:${userId}`, async () => {
      const { data, error } = await readAllPages(() => supabase.from('personal_notes').select('*', { count: 'exact' }).eq('user_id', userId)
        .order('updated_at', { ascending: false }).order('id'));
      if (error) throw new Error('Unable to load notes. Please try again.');
      return data as PersonalNote[];
    });
}
export async function saveNote(userId: string, id: string, title: string, body: string, original?: PersonalNote): Promise<PersonalNote> {
  const finish = beginReadMutation(`notes:${userId}`);
  try {
    if (!title.trim() && !body.trim()) throw new Error('Write a title or note first.');
    const payload = { title: title.trim() || body.trim().split(/\r?\n/)[0].slice(0, 200), body };
    if (!original) {
      const prior = await supabase.from('personal_notes').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
      if (prior.error) throw new Error('Unable to check the note. Your text is still here.');
      if (prior.data) {
        if (!prior.data.deleted_at && prior.data.title === payload.title && prior.data.body === body) return prior.data;
        throw new Error('This note already changed. Close and refresh before editing it.');
      }
    }
    const query = original
      ? supabase.from('personal_notes').update(payload).eq('id', id).eq('user_id', userId).eq('revision', original.revision).is('deleted_at', null)
      : supabase.from('personal_notes').insert({ ...payload, id, user_id: userId });
    const { data, error } = await query.select('*').maybeSingle();
    if (error) throw new Error('Unable to save. Your note is still here; please retry.');
    if (!data) throw new Error('This note changed on another device. Your text is still here.');
    return data;

    } finally { finish(); }
}
export async function setNoteDeleted(note: PersonalNote, deleted: boolean): Promise<PersonalNote> {
  const finish = beginReadMutation(`notes:${note.user_id}`);
  try {
    const { data, error } = await supabase.from('personal_notes').update({ deleted_at: deleted ? new Date().toISOString() : null })
      .eq('id', note.id).eq('user_id', note.user_id).eq('revision', note.revision).select('*').maybeSingle();
    if (error || !data) throw new Error('The note could not be updated. Refresh and try again.');
    return data;

    } finally { finish(); }
}

export async function purgeNotes(userId: string, note?: PersonalNote): Promise<PersonalNote[]> {
  const finish = beginReadMutation(`notes:${userId}`);
  try {
    const base = supabase.from('personal_notes').delete().eq('user_id', userId).not('deleted_at', 'is', null);
    const query = note ? base.eq('id', note.id).eq('revision', note.revision) : base;
    const { error } = await query;
    if (error) throw new Error('Unable to delete notes. Please try again.');
    } finally { finish(); }
  return loadNotes(userId);
}
