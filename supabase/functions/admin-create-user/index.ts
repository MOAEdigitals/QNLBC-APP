// @ts-nocheck Supabase Edge Function runs in Deno, outside the Vite TypeScript runtime.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: caller } = await admin.auth.getUser(token);
    if (!caller.user) throw new Error('Not signed in.');
    const { data: callerProfile } = await admin.from('profiles').select('role, active').eq('id', caller.user.id).maybeSingle();
    if (!callerProfile?.active || callerProfile.role !== 'admin') throw new Error('Administrator access required.');
    const body = await request.json();
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');
    const hasDirectorySelection = Object.prototype.hasOwnProperty.call(body, 'directoryMemberId');
    const directoryMemberId = String(body.directoryMemberId || '');
    // Older APKs can still create an unlinked account during the rollout.
    // A supplied directory identity is always validated; names are never guessed.
    let displayName = String(body.displayName || username).trim();
    if (hasDirectorySelection) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(directoryMemberId)) throw new Error('Choose a church directory person.');
      const { data: person, error: personError } = await admin.from('directory_members').select('id,name,active').eq('id', directoryMemberId).maybeSingle();
      if (personError || !person?.active) throw new Error('Choose an active church directory person.');
      displayName = person.name;
    }
    if (!/^[a-z0-9_.-]{3,40}$/.test(username)) throw new Error('Username must be 3–40 letters, numbers, dots, dashes, or underscores.');
    if (password.length < 6) throw new Error('Password must contain at least 6 characters.');
    const { data, error } = await admin.auth.admin.createUser({
      email: `${username}@qnlbc.local`,
      password,
      email_confirm: true,
      user_metadata: { username, display_name: displayName },
      app_metadata: directoryMemberId ? { directory_member_id: directoryMemberId } : {},
    });
    if (error || !data.user) throw error || new Error('Could not create account.');
    return Response.json({ id: data.user.id }, { headers: cors });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Could not create account.' }, { status: 400, headers: cors });
  }
});

