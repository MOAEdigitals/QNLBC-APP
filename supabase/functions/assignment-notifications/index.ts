// @ts-nocheck Supabase Edge Function executes in Deno.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';
let accessToken: { value: string; expires: number } | null = null;
const encode = (value: Uint8Array) => btoa(String.fromCharCode(...value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const json64 = (value: unknown) => encode(new TextEncoder().encode(JSON.stringify(value)));
async function googleAccessToken(account: { client_email: string; private_key: string }) {
  if (accessToken && accessToken.expires > Date.now() + 60000) return accessToken.value;
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${json64({ alg: 'RS256', typ: 'JWT' })}.${json64({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const raw = atob(account.private_key.replace(/-----[^-]+-----|\s/g, ''));
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(raw, c => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)));
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${encode(signature)}` }), signal: AbortSignal.timeout(15000) });
  const body = await response.json();
  if (!response.ok || typeof body.access_token !== 'string') throw new Error('Push provider authentication failed');
  accessToken = { value: body.access_token, expires: Date.now() + Math.min(Number(body.expires_in) || 3600, 3600) * 1000 };
  return accessToken.value;
}
async function authorized(request: Request, expected: string) {
  const given = request.headers.get('x-notification-secret') || '';
  const bytes = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest('SHA-256', bytes.encode(given)), crypto.subtle.digest('SHA-256', bytes.encode(expected))]);
  return new Uint8Array(a).reduce((difference, byte, index) => difference | (byte ^ new Uint8Array(b)[index]), 0) === 0;
}
Deno.serve(async request => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const secret = Deno.env.get('NOTIFICATIONS_CRON_SECRET');
  if (!secret) return new Response('Notification delivery is not configured', { status: 503 });
  if (!await authorized(request, secret)) return new Response('Unauthorized', { status: 401 });
  const accountJson = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON');
  if (!accountJson) return new Response('Push provider is not configured', { status: 503 });
  try {
    const account = JSON.parse(accountJson);
    if (!account.project_id || !account.private_key || !account.client_email) throw new Error('Push provider configuration is incomplete');
    const token = await googleAccessToken(account);
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data: deliveries, error } = await db.rpc('claim_assignment_pushes', { batch_size: 50 });
    if (error) throw new Error('Could not claim notification deliveries');
    const counts = { sent: 0, retry: 0, invalid: 0 };
    for (let offset = 0; offset < deliveries.length; offset += 5) {
      await Promise.all(deliveries.slice(offset, offset + 5).map(async delivery => {
        let result = 'retry';
        // Keep notification payloads within FCM's byte limit, including Unicode.
        // The complete message remains available in the recipient's inbox.
        const characters = Array.from(String(delivery.body));
        const pushBody = characters.length > 500 ? characters.slice(0, 500).join('') + '…' : delivery.body;
        try {
          const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/messages:send`, {
            method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
            body: JSON.stringify({ message: { token: delivery.token, notification: { title: delivery.title, body: pushBody }, data: { userId: delivery.user_id, ...(delivery.setlist_id ? { setlistId: delivery.setlist_id } : { kind: delivery.kind || 'announcement' }), notificationId: delivery.notification_id }, android: { priority: 'high', ttl: '3600s', notification: { channel_id: 'church-alerts-v2', sound: 'qnlbc_notification', default_vibrate_timings: true, tag: delivery.notification_id, icon: 'ic_notification' } } } }),
          });
          if (response.ok) result = 'sent';
          else {
            const failure = await response.json().catch(() => ({}));
            if (failure.error?.details?.some(detail => detail.errorCode === 'UNREGISTERED')) result = 'invalid';
          }
        } catch { /* Acknowledge as retry; never log device tokens. */ }
        const { error: ackError } = await db.rpc('finish_assignment_push', { delivery: delivery.delivery_id, lease: delivery.lease_id, result });
        if (ackError) throw new Error('Could not acknowledge notification delivery');
        counts[result]++;
      }));
    }
    return Response.json(counts);
  } catch {
    return new Response('Notification delivery failed; queued messages will retry', { status: 503 });
  }
});
