import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const personId = '00000000-0000-0000-0000-000000000123';
function harness(name: 'admin-create-user' | 'admin-update-user', role = 'admin', linked = true) {
  let handler: (r: Request) => Promise<Response>;
  const mutations: any[] = [];
  let directoryReads = 0;
  const admin = {
    auth: { getUser: async () => ({ data: { user: { id: 'admin' } } }), admin: {
      createUser: async (payload: any) => { mutations.push(payload); return { data: { user: { id: 'new-account' } }, error: null }; },
      getUserById: async () => ({ data: { user: { id: 'account', app_metadata: { preserved: 'keep', ...(linked ? { directory_member_id: personId } : {}) } } } }),
      updateUserById: async (_id: string, payload: any) => { mutations.push(payload); return { error: null }; },
    } },
    from: (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => {
      if (table === 'profiles') return { data: { role, active: true } };
      directoryReads++; return { data: { id: personId, name: 'DIRECTORY NAME', active: true } };
    } }) }) }),
  };
  const code = fs.readFileSync(`supabase/functions/${name}/index.ts`, 'utf8');
  runInNewContext(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports: {}, Request, Response,
    Deno: { env: { get: () => 'test-env' }, serve: (fn: typeof handler) => { handler = fn; } },
    require: () => ({ createClient: () => admin }),
  });
  return { mutations, reads: () => directoryReads, call: (extra: object) => handler!(new Request('https://example.test', { method: 'POST', headers: { Authorization: 'Bearer test' }, body: JSON.stringify({ userId: 'account', username: 'church.member', displayName: 'Pastor Test', password: 'test-only-password', ...extra }) })) };
}
test('admin can create an independent account with empty, null or omitted directory selection', async () => {
  for (const extra of [{ directoryMemberId: '' }, { directoryMemberId: null }, {}]) {
    const h = harness('admin-create-user'); assert.equal((await h.call(extra)).status, 200);
    assert.equal(h.reads(), 0); assert.equal(h.mutations[0].user_metadata.display_name, 'Pastor Test');
    assert.equal(h.mutations[0].app_metadata.directory_member_id, undefined);
  }
});
test('linked creation validates the person and uses their canonical name', async () => {
  const h = harness('admin-create-user'); assert.equal((await h.call({ directoryMemberId: personId })).status, 200);
  assert.equal(h.reads(), 1); assert.equal(h.mutations[0].user_metadata.display_name, 'DIRECTORY NAME');
});
test('explicitly clearing an existing link writes null and preserves unrelated metadata', async () => {
  const h = harness('admin-update-user'); assert.equal((await h.call({ directoryMemberId: '', password: '' })).status, 200);
  assert.equal(h.reads(), 0); assert.equal(h.mutations[0].app_metadata.directory_member_id, null);
  assert.equal(h.mutations[0].app_metadata.preserved, 'keep');
  assert.equal(h.mutations[0].user_metadata.display_name, 'Pastor Test');
  assert.equal(h.mutations[0].password, undefined);
});
test('omitting a selection on update preserves the existing link for older clients', async () => {
  const h = harness('admin-update-user'); assert.equal((await h.call({})).status, 200);
  assert.equal(h.mutations[0].app_metadata.directory_member_id, personId);
  assert.equal(h.mutations[0].user_metadata.display_name, 'DIRECTORY NAME');
});
test('both endpoints reject invalid links and non-admin callers without mutating accounts', async () => {
  for (const name of ['admin-create-user', 'admin-update-user'] as const) {
    const invalid = harness(name); assert.equal((await invalid.call({ directoryMemberId: 'not-a-person-id' })).status, 400); assert.equal(invalid.mutations.length, 0);
    const member = harness(name, 'user'); assert.equal((await member.call({ directoryMemberId: '' })).status, 400); assert.equal(member.mutations.length, 0);
  }
});
