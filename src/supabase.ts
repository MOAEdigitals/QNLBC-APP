import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string)?.trim() || '';
const supabasePublishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string)?.trim() || '';
const clientUrl = supabaseUrl || 'https://placeholder-project.supabase.co';
const authStorageKey = `sb-${new URL(clientUrl).hostname.split('.')[0]}-auth-token`;

export function clearDeviceAuthSession() {
  window.localStorage.removeItem(authStorageKey);
  window.localStorage.removeItem(`${authStorageKey}-user`);
}

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabasePublishableKey &&
    !supabaseUrl.includes('placeholder')
  );
};

// Singleton Supabase client instance
// If environment variables are not yet provided, initialize with safe fallback to prevent fatal module crashing
export const supabase: SupabaseClient = createClient(
  clientUrl,
  supabasePublishableKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy',
  {
    auth: {
      persistSession: true,
      storageKey: authStorageKey,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);
