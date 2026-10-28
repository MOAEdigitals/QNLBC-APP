// @ts-nocheck Supabase Edge Function runs in Deno, outside the Vite TypeScript runtime.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });
  if (Number(request.headers.get('Content-Length')) > 4096) return new Response('Request too large', { status: 413, headers: cors });
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error('Invalid username or password.');
    const parts: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); return new Response('Request too large', { status: 413, headers: cors }); }
      parts.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    const { username, password } = JSON.parse(new TextDecoder().decode(bytes));
    const handle = String(username || '').trim().toLowerCase();
    if (!/^[a-z0-9_.-]{3,40}$/.test(handle) || typeof password !== 'string' || !password || password.length > 1024) throw new Error('Invalid username or password.');
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(handle));
    const handleHash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    const { data: allowed, error: limitError } = await admin.rpc('consume_username_login_limit', { handle_hash: handleHash });
    if (limitError) return Response.json({ error: 'Sign-in is temporarily unavailable. Please try again.' }, { status: 503, headers: cors });
    if (!allowed) return Response.json({ error: 'Too many sign-in attempts. Please wait one minute.' }, { status: 429, headers: { ...cors, 'Retry-After': '60' } });
    // Escape LIKE's underscore wildcard while preserving existing case-insensitive logins.
    const literalHandle = handle.replaceAll('_', '\\_');
    const { data: profile } = await admin.from('profiles').select('id, active').ilike('username', literalHandle).maybeSingle();
    if (!profile?.active) throw new Error('Invalid username or password.');
    const { data: authUser } = await admin.auth.admin.getUserById(profile.id);
    if (!authUser.user?.email) throw new Error('Invalid username or password.');
    const auth = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data, error } = await auth.auth.signInWithPassword({ email: authUser.user.email, password });
    if (error || !data.session) throw new Error('Invalid username or password.');
    return Response.json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token }, { headers: cors });
  } catch {
    return Response.json({ error: 'Invalid username or password.' }, { status: 400, headers: cors });
  }
});
