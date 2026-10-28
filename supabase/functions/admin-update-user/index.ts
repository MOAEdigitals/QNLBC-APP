// @ts-nocheck Supabase Edge Function runs in Deno, outside the Vite TypeScript runtime.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';
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
    if (!userId) throw new Error('User is required.');
    const { data: target } = await admin.auth.admin.getUserById(userId);
    if (!target.user) throw new Error('Account not found.');
    const hasDirectorySelection = Object.prototype.hasOwnProperty.call(body, 'directoryMemberId');
    const directoryMemberId = String(hasDirectorySelection ? body.directoryMemberId || '' : target.user.app_metadata?.directory_member_id || '');
    let displayName = String(body.displayName || username).trim();
    if (hasDirectorySelection || directoryMemberId) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(directoryMemberId)) throw new Error('Choose a church directory person.');
      const { data: person, error: personError } = await admin.from('directory_members').select('id,name,active').eq('id', directoryMemberId).maybeSingle();
      if (personError || !person?.active) throw new Error('Choose an active church directory person.');
      displayName = person.name;
    }
    const password = String(body.password || '');
    if (!userId) throw new Error('User is required.');
    if (!/^[a-z0-9_.-]{3,40}$/.test(username)) throw new Error('Username must be 3–40 letters, numbers, dots, dashes, or underscores.');
    if (password && password.length < 10) throw new Error('Password must contain at least 10 characters.');
    const updates = { app_metadata: { ...target.user.app_metadata, ...(directoryMemberId ? { directory_member_id: directoryMemberId } : {}) }, email: `${username}@qnlbc.local`, user_metadata: { username, display_name: displayName }, ...(password ? { password } : {}) };
    const { error } = await admin.auth.admin.updateUserById(userId, updates);
    if (error) throw error;
    // The Auth trigger updates profile identity in the same transaction.
    return Response.json({ success: true }, { headers: cors });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Could not update account.' }, { status: 400, headers: cors });
  }
});

