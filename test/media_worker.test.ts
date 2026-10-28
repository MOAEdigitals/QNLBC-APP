import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';

function fixture({ active = true, canUpload = true, authenticated = true } = {}) {
  const objects = new Map();
  let writes = 0;
  const worker = runInNewContext(readFileSync('cloudflare/media-worker.mjs', 'utf8').replace('export default', 'worker ='), {
    Response, URL, Uint8Array, crypto: webcrypto,
    fetch: async (url: string) => url.includes('/auth/')
      ? new Response(JSON.stringify({ id: 'member-id' }), { status: authenticated ? 200 : 401 })
      : new Response(JSON.stringify([{ active, role: 'user', can_upload: canUpload }])),
  });
  const env = { SUPABASE_PUBLISHABLE_KEY: 'public-test-key', AUDIO_BUCKET: {
    async put(key: string, bytes: Uint8Array, options: any) { writes++; objects.set(key, { size: bytes.length, customMetadata: options.customMetadata }); },
    async head(key: string) { return objects.get(key); },
  } };
  return { objects, writes: () => writes, send: (headers: Record<string, string> = {}, body = 'audio') => worker.fetch(new Request('https://media.example/api/upload-media', {
    method: 'POST', headers: { Origin: 'https://moaedigitals.github.io', Authorization: 'Bearer test', 'Content-Type': 'audio/webm', ...headers }, body,
  }), env) };
}

test('R2 retries reuse an immutable content key and return verified size/hash', async () => {
  const f = fixture();
  const first = await (await f.send()).json();
  const retry = await (await f.send()).json();
  assert.equal(first.url, retry.url);
  assert.equal(first.size, 5);
  assert.match(first.sha256, /^[a-f0-9]{64}$/);
  assert.equal(f.objects.size, 1);
  assert.equal(first.provider, 'cloudflare-r2');
});
test('R2 rejects anonymous, inactive and unauthorized uploaders without writing', async () => {
  for (const options of [{ authenticated: false }, { active: false }, { canUpload: false }]) {
    const f = fixture(options);
    assert.ok([401, 403].includes((await f.send()).status));
    assert.equal(f.writes(), 0);
  }
  const f = fixture();
  assert.equal((await f.send({ Authorization: '' })).status, 401);
  assert.equal(f.writes(), 0);
});
test('R2 rejects foreign origins, empty files, HTML and oversized uploads', async () => {
  const f = fixture();
  assert.equal((await f.send({ Origin: 'https://untrusted.example' })).status, 403);
  assert.equal((await f.send({}, '')).status, 400);
  assert.equal((await f.send({ 'Content-Type': 'text/html' })).status, 415);
  assert.equal((await f.send({ 'Content-Length': String(51 * 1024 * 1024) })).status, 413);
  assert.equal(f.writes(), 0);
});
