import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

export function useDirectoryAvatars(userId?: string) {
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  useEffect(() => {
    setAvatars({});
    if (!userId) return;
    let stopped = false, sequence = 0;
    const refresh = async () => {
      try {
      const own = ++sequence;
      const { data, error } = await supabase.rpc('list_directory_avatars');
      if (stopped || own !== sequence || error) return;
      const next: Record<string, string> = {};
      for (const row of data || []) if (row.name && row.avatar_url) next[row.name.trim().toLowerCase()] = row.avatar_url;
      setAvatars(next);
      } catch { /* Keep the last verified pictures during a network interruption. */ }
    };
    void refresh();
    const channel = supabase.channel(`directory-avatars-${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'directory_members' }, () => void refresh()).subscribe();
    const visible = () => { if (document.visibilityState === 'visible') void refresh(); };
    const timer = window.setInterval(visible, 60000);
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('qnlbc-avatar-updated', visible);
    return () => { stopped = true; void supabase.removeChannel(channel); clearInterval(timer); document.removeEventListener('visibilitychange', visible); window.removeEventListener('qnlbc-avatar-updated', visible); };
  }, [userId]);
  return avatars;
}
