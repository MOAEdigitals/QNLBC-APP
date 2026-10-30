import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';

const id = '11111111-1111-4111-8111-111111111111';
const origin = 'https://qnlbc-media.aigems2026.workers.dev';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNy0AAAAASUVORK5CYII=', 'base64');
function fixture({ active = true, authenticated = true, accessible = true } = {}) {
  const objects = new Map<string, any>(); let authCalls = 0;
  const worker = runInNewContext(readFileSync('cloudflare/media-worker.mjs', 'utf8').replace('export default', 'worker ='), {
    Response, URL, Uint8Array, DataView, TextEncoder, AbortSignal, crypto: webcrypto,
    fetch: async (url: string, options: any) => {
      authCalls++;
      assert.equal(options.headers.Authorization, 'Bearer test', 'all database reads retain the user JWT');
      if (url.includes('/auth/')) return new Response(JSON.stringify({ id: 'member' }), { status: authenticated ? 200 : 401 });
      if (url.includes('/profiles?')) return Response.json([{ active }]);
      assert.ok(url.includes('deleted_at=is.null'));
      return Response.json(accessible ? [{ id, title: 'Sunday <script>alert(1)</script>', service_date: '2026-11-01' }] : []);
    },
  });
  const env = { SUPABASE_PUBLISHABLE_KEY: 'public-test', AUDIO_BUCKET: {
    async put(key: string, bytes: Uint8Array, options: any) { if (objects.has(key) && options.onlyIf) return null; objects.set(key, { size: bytes.length, customMetadata: options.customMetadata, body: bytes }); },
    async head(key: string) { return objects.get(key) || null; },
    async get(key: string) { return objects.get(key) || null; },
  } };
  const send = (path = `/api/share-setlist?setlist=${id}`, init?: RequestInit) => worker.fetch(new Request(`${origin}${path}`, init || { method: 'POST', headers: { Origin: 'https://moaedigitals.github.io', Authorization: 'Bearer test', 'Content-Type': 'image/png' }, body: png }), env);
  return { send, objects, authCalls: () => authCalls };
}

test('preview snapshot emits server-rendered Open Graph PNG metadata and opens the exact private app setlist', async () => {
  const f = fixture();
  const first = await (await f.send()).json();
  const retry = await (await f.send()).json();
  assert.equal(first.url, retry.url, 'same content reuses its immutable preview');
  assert.equal(f.objects.size, 1);
  const path = new URL(first.url).pathname, calls = f.authCalls();
  const page = await f.send(path, { headers: { 'User-Agent': 'facebookexternalhit/1.1' } });
  const html = await page.text();
  assert.equal(page.status, 200);
  assert.match(html, /property="og:image"/);
  assert.ok(html.includes(`https://pub-aaa45e93104541548f563b3496acae00.r2.dev/setlist_previews/${path.split('/')[2]}`));
  assert.equal(new URL(first.url).search, '?v=2', 'new shares use fresh metadata instead of old Messenger cache');
  assert.ok(html.includes(`location.replace("https://moaedigitals.github.io/QNLBC-APP/?setlist=${id}#home")`));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('Sunday <script>'));
  assert.ok(!html.includes('Bearer test'));
  assert.ok(page.headers.get('Content-Security-Policy')?.includes("frame-ancestors 'none'"));
  const image = await f.send(`${path}/image.png`, {});
  assert.equal(image.headers.get('Content-Type'), 'image/png');
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
  const head = await f.send(`${path}/image.png`, { method: 'HEAD' });
  assert.equal(head.status, 200); assert.equal(await head.text(), '');
  assert.equal(f.authCalls(), calls, 'public crawlers can only read the saved snapshot, without database access');
  assert.equal((await f.send(path, { headers: { Origin: 'https://www.facebook.com' } })).status, 200, 'public preview pages allow social origins');
  assert.equal((await f.send(`${path}/image.png`, { headers: { Origin: 'https://www.facebook.com' } })).status, 200, 'public images allow social origins');
  assert.equal((await f.send(path.replace(/.$/, path.endsWith('a') ? 'b' : 'a'), {})).status, 404);
});

test('preview creation enforces authentication, active account, RLS, origin, image type and received-byte limit', async () => {
  for (const options of [{ authenticated: false }, { active: false }, { accessible: false }]) {
    const f = fixture(options); assert.ok([401,403,404].includes((await f.send()).status)); assert.equal(f.objects.size, 0);
  }
  const f = fixture();
  const base = { Authorization: 'Bearer test', 'Content-Type': 'image/png' };
  for (const [headers, body, status] of [
    [{ ...base, Authorization: '' }, png, 401],
    [{ ...base, Origin: 'https://evil.example' }, png, 403],
    [{ ...base, 'Content-Type': 'image/svg+xml' }, '<svg/>', 415],
    [base, 'not a PNG', 415],
    [base, new Uint8Array(3 * 1024 * 1024 + 1), 413],
  ] as const) assert.equal((await f.send(undefined, { method: 'POST', headers, body: body as any })).status, status);
  assert.equal(f.objects.size, 0);
  assert.equal((await f.send('/share/guess', {})).status, 404);
});

test('preview client rejects unrelated returned URLs and sends image with the current user token', async () => {
  const exports: any = {}; let returned = `${origin}/share/${'a'.repeat(64)}/${'b'.repeat(32)}`, requests = 0;
  runInNewContext(ts.transpileModule(readFileSync('src/services/setlistPreview.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, AbortSignal, Error,
    require: () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'test' } } }) } } }),
    fetch: async (url: string, init: any) => { requests++; assert.equal(init.headers.Authorization, 'Bearer test'); assert.ok(url.endsWith(id)); return Response.json({ url: returned }); },
  });
  const image = new File([png], 'card.png', { type: 'image/png' });
  assert.equal(await exports.createSetlistPreview(id, image), returned);
  returned = 'https://evil.example/';
  await assert.rejects(exports.createSetlistPreview(id, image), /verified/);
  await assert.rejects(exports.createSetlistPreview(id, new File(['x'], 'bad.svg', { type: 'image/svg+xml' })));
  assert.equal(requests, 2);
});

test('share dialog creates a preview on request, then shares one clickable URL without a file attachment', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://moaedigitals.github.io/QNLBC-APP/' });
  const keys = ['window', 'document', 'navigator', 'HTMLElement', 'IS_REACT_ACT_ENVIRONMENT'];
  const old = keys.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  keys.forEach(key => Object.defineProperty(globalThis, key, { configurable: true, value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : (dom.window as any)[key] }));
  const require = createRequire(import.meta.url), React = require('react'), { act } = React;
  const root = require('react-dom/client').createRoot(document.getElementById('root'));
  const exports: any = {}, shares: any[] = []; let creates = 0;
  const preview = `${origin}/share/${'a'.repeat(64)}/${'b'.repeat(32)}`;
  runInNewContext(ts.transpileModule(readFileSync('src/components/SetlistShareDialog.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, {
    exports, document, File, Error, URL: { createObjectURL: () => 'blob:card', revokeObjectURL() {} },
    require: (name: string) => name.includes('html-to-image') ? { toBlob: async () => new Blob([png], { type: 'image/png' }) }
      : name.includes('SetlistShareCard') ? { SetlistShareCard: React.forwardRef((_: any, ref: any) => React.createElement('div', { ref })) }
      : name.includes('setlistSharing') ? { setlistShareUrl: () => 'https://moaedigitals.github.io/QNLBC-APP/?setlist=test#home', setlistTitle: () => 'Sunday Service' }
      : name.includes('setlistPreview') ? { createSetlistPreview: async (receivedId: string) => { creates++; assert.equal(receivedId, id); return preview; } }
      : name.includes('setlistShare') ? { shareSetlistContent: async (...args: any[]) => { shares.push(args); return 'shared'; } }
      : name.includes('useBackLayer') ? { useBackLayer() {} } : require(name),
  });
  const button = (label: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === label)!;
  try {
    await act(async () => root.render(React.createElement(exports.SetlistShareDialog, { item: { id, date: '2026-11-01' }, songs: [], onClose() {} })));
    assert.equal(creates, 0, 'opening local preview does not publish a card');
    await act(async () => button('Create preview link').click());
    assert.equal(creates, 1); assert.equal(shares.length, 0, 'network preparation does not consume the share gesture');
    assert.equal(document.querySelector<HTMLInputElement>('[aria-label="Setlist link"]')!.value, preview);
    assert.ok(button('Copy preview link'));
    await act(async () => button('Share preview link').click());
    assert.equal(shares.length, 1); assert.equal(shares[0][1], preview); assert.equal(shares[0].length, 2, 'no file is sent for Messenger to discard its caption');
  } finally {
    await act(() => root.unmount()); dom.window.close();
    keys.forEach((key, index) => { if (old[index]) Object.defineProperty(globalThis, key, old[index]!); else delete (globalThis as any)[key]; });
  }
});
