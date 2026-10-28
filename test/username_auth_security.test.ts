import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';

function harness(allowed: boolean, failLimit = false) {
  let handler: (request: Request) => Promise<Response>;
  const calls: string[] = [];
  const admin = {
    rpc: async (_name: string, args: { handle_hash: string }) => {
      assert.match(args.handle_hash, /^[0-9a-f]{64}$/);
      calls.push('limit'); return { data: allowed, error: failLimit ? new Error('offline') : null };
    },
    from: () => { calls.push('lookup'); return { select: () => ({ ilike: () => ({ maybeSingle: async () => ({ data: { id: 'member', active: true } }) }) }) }; },
    auth: {
      admin: { getUserById: async () => ({ data: { user: { email: 'member@example.test' } } }) },
      signInWithPassword: async () => { calls.push('password'); return { data: { session: { access_token: 'test-access', refresh_token: 'test-refresh' } }, error: null }; },
    },
  };
  const source = fs.readFileSync('supabase/functions/username-auth/index.ts', 'utf8');
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports: {}, Request, Response, TextEncoder, TextDecoder, Uint8Array, crypto: webcrypto,
    Deno: { env: { get: () => 'test-env' }, serve: (callback: typeof handler) => { handler = callback; } },
    require: () => ({ createClient: () => admin }),
  });
  return { call: (body: string, method = 'POST') => handler!(new Request('https://example.test', { method, ...(method === 'POST' ? { body } : {}) })), calls };
}
const login = JSON.stringify({ username: 'existing_member', password: 'old123' });
test('login throttle blocks before any account lookup or password request', async () => {
  const h = harness(false); const response = await h.call(login);
  assert.equal(response.status, 429); assert.equal(response.headers.get('Retry-After'), '60');
  assert.deepEqual(h.calls, ['limit']);
});
test('login fails closed when the shared counter is unavailable', async () => {
  const h = harness(true, true); assert.equal((await h.call(login)).status, 503);
  assert.deepEqual(h.calls, ['limit']);
});
test('existing shorter passwords can still sign in after throttling', async () => {
  const h = harness(true); const response = await h.call(login);
  assert.equal(response.status, 200); assert.deepEqual(h.calls, ['limit', 'lookup', 'password']);
});
test('malformed, oversized, and wrong-method requests never reach privileged lookup', async () => {
  const h = harness(true);
  assert.equal((await h.call('{')).status, 400);
  assert.equal((await h.call('x'.repeat(4097))).status, 413);
  assert.equal((await h.call('', 'GET')).status, 405);
  assert.deepEqual(h.calls, []);
});
