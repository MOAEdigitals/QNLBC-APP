import { supabase } from '../supabase';
export interface DirectoryMember { id: string; name: string; active: boolean; linked_user_id: string | null }
export async function fetchDirectoryMembers(): Promise<DirectoryMember[]> {
  const { data, error } = await supabase.rpc('list_directory_members');
  if (error) throw new Error('Church directory could not be loaded. Please try again.');
  return data || [];
}
export async function saveDirectoryMember(id: string | null, name: string, active = true): Promise<void> {
  const { error } = await supabase.rpc('save_directory_member', { member_id: id, member_name: name.trim(), is_active: active });
  if (error) throw new Error(error.message);
}
