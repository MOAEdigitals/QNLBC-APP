// R2 binding: AUDIO_BUCKET -> worship-audio. No storage credentials in the app.
const ORIGINS = new Set(['https://moaedigitals.github.io', 'http://localhost:5173',
  'http://127.0.0.1:5173', 'https://localhost', 'http://localhost', 'capacitor://localhost']);
const MAX_BYTES = 50 * 1024 * 1024;
const SUPABASE_URL = 'https://gprarwhcvqxjguswmkbe.supabase.co';
const PUBLIC_URL = 'https://pub-aaa45e93104541548f563b3496acae00.r2.dev';

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/share/') || path === '/api/share-setlist') return handleSetlistPreview(request, env);
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

const APP_URL = 'https://moaedigitals.github.io/QNLBC-APP/';
const SHARE_ORIGIN = 'https://qnlbc-media.aigems2026.workers.dev';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PREVIEW_LIMIT = 3 * 1024 * 1024;
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

async function handleSetlistPreview(request, env) {
  const url = new URL(request.url), origin = request.headers.get('Origin');
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin' };
  if (origin && ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });
  if (!env.AUDIO_BUCKET) return reply(503, { error: 'Preview storage is unavailable.' });
  try {
    if (url.pathname.startsWith('/share/')) {
      if (!['GET', 'HEAD'].includes(request.method)) return reply(405, { error: 'Method not allowed.' });
      const match = /^\/share\/([a-f0-9]{64})\/([a-f0-9]{32})(\/image.png)?$/.exec(url.pathname);
      if (!match) return reply(404, { error: 'Preview not found.' });
      const key = `setlist_previews/${match[1]}`;
      const object = match[3] && request.method === 'GET' ? await env.AUDIO_BUCKET.get(key) : await env.AUDIO_BUCKET.head(key);
      const meta = object?.customMetadata;
      if (!meta || meta.token !== match[2] || !UUID.test(meta.setlistId)) return reply(404, { error: 'Preview not found.' });
      const publicHeaders = { 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' };
      if (match[3]) return new Response(request.method === 'HEAD' ? null : object.body, { headers: { ...publicHeaders, 'Content-Type': 'image/png' } });
      const previewUrl = `${SHARE_ORIGIN}/share/${match[1]}/${match[2]}?v=2`;
      const imageUrl = `${PUBLIC_URL}/${key}`;
      const appUrl = `${APP_URL}?setlist=${meta.setlistId}#home`;
      const title = escapeHtml(meta.title), description = 'QNLBC setlist · Open the setlist in QNLBC. Sign-in required in the app.';
      const nonce = crypto.randomUUID().replaceAll('-', '');
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · QNLBC</title>
<meta property="og:type" content="website"><meta property="og:site_name" content="QNLBC"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:url" content="${previewUrl}"><meta property="og:image" content="${imageUrl}"><meta property="og:image:secure_url" content="${imageUrl}"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="${meta.width}"><meta property="og:image:height" content="${meta.height}"><meta property="og:image:alt" content="${title} setlist card"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${imageUrl}"></head>
<body><h1>${title}</h1><p><a href="${appUrl}">Open setlist in QNLBC</a></p><img src="${imageUrl}" alt="${title}" width="390"><script nonce="${nonce}">location.replace(${JSON.stringify(appUrl)})</script></body></html>`;
      return new Response(request.method === 'HEAD' ? null : html, { headers: { ...publicHeaders, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': `default-src 'none'; img-src 'self' ${PUBLIC_URL}; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'` } });
    }
    // Origin restrictions apply to authenticated creation, not already-public cards.
    if (origin && !ORIGINS.has(origin)) return reply(403, { error: 'Origin not allowed.' });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' } });
    if (request.method !== 'POST') return reply(405, { error: 'Method not allowed.' });
    const id = url.searchParams.get('setlist');
    if (!id || !UUID.test(id)) return reply(400, { error: 'Save this setlist before sharing it.' });
    const authorization = request.headers.get('Authorization') || '';
    if (!authorization.startsWith('Bearer ')) return reply(401, { error: 'Please sign in.' });
    if (!env.SUPABASE_PUBLISHABLE_KEY) return reply(503, { error: 'Preview authentication is unavailable.' });
    const authHeaders = { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: authorization };
    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: authHeaders, signal: AbortSignal.timeout(15000) });
    if (!userResponse.ok) return reply(401, { error: 'Please sign in again.' });
    const user = await userResponse.json();
    if (!user.id) return reply(401, { error: 'Please sign in again.' });
    const profileResponse = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=active`, { headers: authHeaders, signal: AbortSignal.timeout(15000) });
    if (!profileResponse.ok) return reply(503, { error: 'Could not verify account.' });
    const profiles = await profileResponse.json();
    if (!profiles[0]?.active) return reply(403, { error: 'An active account is required.' });
    // The caller's JWT and RLS, never a privileged key, determine access.
    const setlistResponse = await fetch(`${SUPABASE_URL}/rest/v1/setlists?id=eq.${id}&deleted_at=is.null&select=id,title,type,service_date`, { headers: authHeaders, signal: AbortSignal.timeout(15000) });
    if (!setlistResponse.ok) return reply(403, { error: 'This setlist is unavailable.' });
    const setlists = await setlistResponse.json(), setlist = setlists[0];
    if (!setlist || setlist.id !== id) return reply(404, { error: 'This setlist is unavailable.' });
    if (request.headers.get('Content-Type')?.split(';')[0] !== 'image/png') return reply(415, { error: 'A PNG setlist card is required.' });
    if (Number(request.headers.get('Content-Length')) > PREVIEW_LIMIT) return reply(413, { error: 'Preview must be under 3 MB.' });
    if (!request.body) return reply(400, { error: 'Preview image is empty.' });
    const reader = request.body.getReader(), chunks = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > PREVIEW_LIMIT) { await reader.cancel(); return reply(413, { error: 'Preview must be under 3 MB.' }); } chunks.push(value); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    if (size < 24 || ![137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82].every((byte, index) => bytes[index] === byte)) return reply(415, { error: 'Invalid PNG image.' });
    const view = new DataView(bytes.buffer), width = view.getUint32(16), height = view.getUint32(20);
    if (!width || !height || width > 4096 || height > 8192) return reply(400, { error: 'Invalid preview dimensions.' });
    const identity = new TextEncoder().encode(id), hashBytes = new Uint8Array(identity.length + bytes.length);
    hashBytes.set(identity); hashBytes.set(bytes, identity.length);
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', hashBytes))].map(byte => byte.toString(16).padStart(2, '0')).join('');
    const key = `setlist_previews/${hash}`;
    const fallbackTitle = { sunday: 'Sunday Service', prayer_meeting: 'Midweek Prayer Meeting', fellowship: 'Fellowship', event: 'Special Event' }[setlist.type] || 'Setlist';
    const title = `${String(setlist.title || fallbackTitle).trim().slice(0, 180)} · ${String(setlist.service_date || '').slice(0, 10)}`;
    // Content-addressed, create-only snapshots preserve previously shared links.
    await env.AUDIO_BUCKET.put(key, bytes, { onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType: 'image/png', cacheControl: 'public, max-age=31536000, immutable' }, customMetadata: { token: crypto.randomUUID().replaceAll('-', ''), setlistId: id, title, width: String(width), height: String(height) } });
    const saved = await env.AUDIO_BUCKET.head(key);
    if (!saved || saved.size !== size || !saved.customMetadata?.token) return reply(502, { error: 'Preview could not be verified.' });
    return reply(200, { url: `${SHARE_ORIGIN}/share/${hash}/${saved.customMetadata.token}?v=2` });
  } catch { return reply(503, { error: 'Unable to prepare preview. Please retry.' }); }
}
