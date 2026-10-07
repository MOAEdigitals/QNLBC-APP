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
    const { userId } = await request.json();
    if (!userId || userId === caller.user.id) throw new Error('You cannot delete your own account.');
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
    return Response.json({ success: true }, { headers: cors });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Could not delete account.' }, { status: 400, headers: cors });
  }
});
