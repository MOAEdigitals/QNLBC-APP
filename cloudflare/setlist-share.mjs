const APP = 'https://moaedigitals.github.io/QNLBC-APP/';
const WORKER = 'https://qnlbc-media.aigems2026.workers.dev';
const DATABASE = 'https://gprarwhcvqxjguswmkbe.supabase.co';
const LIMIT = 5 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const titleOf = item => item.title?.trim() || ({sunday:'Sunday Service',prayer_meeting:'Midweek Prayer Meeting',fellowship:'Fellowship',event:'Special Event'}[item.type || 'sunday']);

/** Public snapshots are created only by an explicit authenticated share action. No account/session data is stored. */
export async function handleSetlistShare(request, env, reply) {
  const path = new URL(request.url).pathname;
  if (request.method === 'GET' || request.method === 'HEAD') {
    const match = path.match(/^\/share\/([a-f0-9]{64})(\.png)?$/);
    if (!match) return reply(404, {error:'Share not found.'});
    const object = await env.AUDIO_BUCKET.get(`setlist-shares/${match[1]}.png`);
    if (!object) return reply(404, {error:'Share not found.'});
    const security = {'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'public, max-age=86400'};
    if (match[2]) return new Response(request.method === 'HEAD' ? null : object.body, {headers:{...security,'Content-Type':'image/png','Content-Length':String(object.size)}});
    const {title, date, setlistId} = object.customMetadata || {};
    if (!UUID.test(setlistId || '')) return reply(404,{error:'Share not found.'});
    const link = `${APP}?setlist=${setlistId}#home`, share = `${WORKER}/share/${match[1]}`, image = `${share}.png`;
    const name = `${title} · ${date}`;
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(name)}</title><meta name="robots" content="noindex,nofollow"><meta property="og:type" content="website"><meta property="og:site_name" content="QNLBC"><meta property="og:title" content="${escape(name)}"><meta property="og:description" content="View this setlist in QNLBC Team"><meta property="og:url" content="${share}"><meta property="og:image" content="${image}"><meta property="og:image:secure_url" content="${image}"><meta property="og:image:type" content="image/png"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${image}"></head><body style="margin:0;padding:24px;background:#020617;color:#fff;font-family:system-ui;text-align:center"><h1>${escape(name)}</h1><p>Shared setlist snapshot</p><p><a href="${link}" style="display:inline-block;padding:16px;background:#1d4ed8;color:white;border-radius:12px;text-decoration:none">Open in QNLBC Team</a></p><img src="${image}" alt="${escape(name)}" style="width:100%;max-width:720px;border-radius:16px"><p>Sign in to QNLBC to view the current setlist. This image shows the version shared.</p></body></html>`;
    return new Response(request.method === 'HEAD' ? null : html,{headers:{...security,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"}});
  }
  if (path !== '/api/share-setlist' || request.method !== 'POST') return reply(404,{error:'Not found.'});
  const authorization=request.headers.get('Authorization') || '', setlistId=request.headers.get('X-Setlist-Id') || '';
  if (!authorization.startsWith('Bearer ')) return reply(401,{error:'Please sign in.'});
  if (!UUID.test(setlistId)) return reply(400,{error:'Save this setlist before sharing.'});
  if (!env.SUPABASE_PUBLISHABLE_KEY || !env.AUDIO_BUCKET) return reply(503,{error:'Share previews are unavailable.'});
  if (request.headers.get('Content-Type') !== 'image/png') return reply(415,{error:'PNG image required.'});
  const authHeaders={apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:authorization};
  const userResponse=await fetch(`${DATABASE}/auth/v1/user`,{headers:authHeaders});
  if (!userResponse.ok) return reply(401,{error:'Please sign in again.'});
  const user=await userResponse.json();
  if (!user.id || !UUID.test(user.id)) return reply(401,{error:'Please sign in again.'});
  const profileResponse=await fetch(`${DATABASE}/rest/v1/profiles?id=eq.${user.id}&select=active`,{headers:authHeaders});
  if (!profileResponse.ok || !(await profileResponse.json())[0]?.active) return reply(403,{error:'Active account required.'});
  const setlistResponse=await fetch(`${DATABASE}/rest/v1/setlists?id=eq.${setlistId}&deleted_at=is.null&select=id,title,type,service_date`,{headers:authHeaders});
  if (!setlistResponse.ok) return reply(403,{error:'This setlist is unavailable.'});
  const item=(await setlistResponse.json())[0];
  if (!item) return reply(404,{error:'This setlist is unavailable.'});
  if (Number(request.headers.get('Content-Length'))>LIMIT) return reply(413,{error:'Share image is too large.'});
  if (!request.body) return reply(400,{error:'Image required.'});
  const reader=request.body.getReader(),chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>LIMIT){await reader.cancel();return reply(413,{error:'Share image is too large.'});}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  if (size<24 || [137,80,78,71,13,10,26,10].some((byte,index)=>bytes[index]!==byte)) return reply(415,{error:'Invalid PNG image.'});
  const digest=new Uint8Array(size+setlistId.length);digest.set(new TextEncoder().encode(setlistId));digest.set(bytes,setlistId.length);
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',digest))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  const key=`setlist-shares/${hash}.png`;
  if (!await env.AUDIO_BUCKET.head(key)) await env.AUDIO_BUCKET.put(key,bytes,{httpMetadata:{contentType:'image/png'},customMetadata:{setlistId,title:titleOf(item),date:item.service_date}});
  const saved=await env.AUDIO_BUCKET.head(key);
  if (!saved || saved.size!==size) return reply(502,{error:'Could not verify share preview.'});
  return reply(200,{url:`${WORKER}/share/${hash}`,size});
}
