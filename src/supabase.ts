import { createClient, SupabaseClient } from '@supabase/supabase-js';

const env = (typeof import.meta !== 'undefined' && (import.meta as any).env) || process.env || {};
const supabaseUrl = (env.VITE_SUPABASE_URL as string)?.trim() || '';
const supabasePublishableKey = (env.VITE_SUPABASE_PUBLISHABLE_KEY as string)?.trim() || '';

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
  supabaseUrl || 'https://placeholder-project.supabase.co',
  supabasePublishableKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy',
  {
    auth: {
      persistSession: true,
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
