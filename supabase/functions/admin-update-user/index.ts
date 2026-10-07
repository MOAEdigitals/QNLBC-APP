// @ts-nocheck Supabase Edge Function runs in Deno, outside the Vite TypeScript runtime.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: caller } = await admin.auth.getUser(token);
    if (!caller.user) throw new Error('Not signed in.');
    const { data: profile } = await admin.from('profiles').select('role, active').eq('id', caller.user.id).maybeSingle();
    if (!profile?.active || profile.role !== 'admin') throw new Error('Administrator access required.');
    const body = await request.json();
    const userId = String(body.userId || '');
    const username = String(body.username || '').trim().toLowerCase();
    const displayName = String(body.displayName || username).trim();
    const password = String(body.password || '');
    if (!userId) throw new Error('User is required.');
    if (!/^[a-z0-9_.-]{3,40}$/.test(username)) throw new Error('Username must be 3–40 letters, numbers, dots, dashes, or underscores.');
    if (password && password.length < 6) throw new Error('Password must contain at least 6 characters.');
    const updates = { email: `${username}@qnlbc.local`, user_metadata: { username, display_name: displayName }, ...(password ? { password } : {}) };
    const { error } = await admin.auth.admin.updateUserById(userId, updates);
    if (error) throw error;
    const { error: profileError } = await admin.from('profiles').update({ username, display_name: displayName }).eq('id', userId);
    if (profileError) throw profileError;
    return Response.json({ success: true }, { headers: cors });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Could not update account.' }, { status: 400, headers: cors });
  }
});
