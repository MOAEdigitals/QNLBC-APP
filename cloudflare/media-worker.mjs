// R2 binding: AUDIO_BUCKET -> worship-audio. No storage credentials in the app.
const ORIGINS = new Set(['https://moaedigitals.github.io', 'http://localhost:5173',
  'http://127.0.0.1:5173', 'https://localhost', 'http://localhost', 'capacitor://localhost']);
const MAX_BYTES = 50 * 1024 * 1024;
const SUPABASE_URL = 'https://gprarwhcvqxjguswmkbe.supabase.co';
const PUBLIC_URL = 'https://pub-aaa45e93104541548f563b3496acae00.r2.dev';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' };
    if (origin && ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });
    if (origin && !ORIGINS.has(origin)) return reply(403, { error: 'Origin not allowed.' });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
      ...headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-File-Name',
      'Access-Control-Max-Age': '600',
    } });
    if (new URL(request.url).pathname !== '/api/upload-media' || request.method !== 'POST') {
      return reply(404, { error: 'Not found.' });
    }
    const authorization = request.headers.get('Authorization') || '';
    if (!authorization.startsWith('Bearer ')) return reply(401, { error: 'Please sign in.' });
    if (!env.SUPABASE_PUBLISHABLE_KEY || !env.AUDIO_BUCKET) return reply(503, { error: 'Media storage is not configured.' });
    try {
      const authHeaders = { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: authorization };
      const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: authHeaders });
      if (!userResponse.ok) return reply(401, { error: 'Please sign in again.' });
      const user = await userResponse.json();
      if (!user.id) return reply(401, { error: 'Please sign in again.' });
      const profileResponse = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=active,role,can_upload`, { headers: authHeaders });
      if (!profileResponse.ok) return reply(503, { error: 'Could not verify upload permission.' });
      const profiles = await profileResponse.json();
      const profile = profiles[0];
      if (!profile?.active || !(profile.role === 'admin' || profile.can_upload === true)) {
        return reply(403, { error: 'You do not have upload permission.' });
      }
      const type = (request.headers.get('Content-Type') || '').split(';')[0].toLowerCase();
      if (!/^(audio|video)\/[a-z0-9.+-]+$/.test(type) && type !== 'application/octet-stream') {
        return reply(415, { error: 'Choose an audio or video file.' });
      }
      if (Number(request.headers.get('Content-Length')) > MAX_BYTES) return reply(413, { error: 'Maximum file size is 50 MB.' });
      if (!request.body) return reply(400, { error: 'The file is empty.' });
      const reader = request.body.getReader();
      const chunks = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) { await reader.cancel(); return reply(413, { error: 'Maximum file size is 50 MB.' }); }
        chunks.push(value);
      }
      if (!size) return reply(400, { error: 'The file is empty.' });
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
        .map(byte => byte.toString(16).padStart(2, '0')).join('');
      // Immutable content keys make retries safe and never overwrite another recording.
      const key = `worship_media/verified/${sha256}`;
      const fileName = decodeURIComponent(request.headers.get('X-File-Name') || 'recording').slice(0, 255);
      await env.AUDIO_BUCKET.put(key, bytes, { sha256,
        httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' },
        customMetadata: { sha256, uploadedBy: user.id, fileName },
      });
      const saved = await env.AUDIO_BUCKET.head(key);
      if (!saved || saved.size !== size || saved.customMetadata?.sha256 !== sha256) {
        return reply(502, { error: 'Recording verification failed. Please retry.' });
      }
      return reply(200, { success: true, url: `${PUBLIC_URL}/${key}`, fileName, size,
        sha256, isCloudUrl: true, provider: 'cloudflare-r2' });
    } catch {
      return reply(503, { error: 'Unable to save recording. Please retry.' });
    }
  },
};
