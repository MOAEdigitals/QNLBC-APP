// @ts-nocheck Supabase Edge Function runs in Deno, outside the Vite TypeScript runtime.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { username, password } = await request.json();
    const handle = String(username || '').trim().toLowerCase();
    if (!/^[a-z0-9_.-]{3,40}$/.test(handle) || !password) throw new Error('Invalid username or password.');
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: profile } = await admin.from('profiles').select('id, active').ilike('username', handle).maybeSingle();
    if (!profile?.active) throw new Error('Invalid username or password.');
    const { data: authUser } = await admin.auth.admin.getUserById(profile.id);
    if (!authUser.user?.email) throw new Error('Invalid username or password.');
    const auth = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data, error } = await auth.auth.signInWithPassword({ email: authUser.user.email, password });
    if (error || !data.session) throw new Error('Invalid username or password.');
    return Response.json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token }, { headers: cors });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Sign-in failed.' }, { status: 400, headers: cors });
  }
});
