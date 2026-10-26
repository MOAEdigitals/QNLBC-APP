import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
const user1 = '00000000-0000-0000-0000-000000000001';
const user2 = '00000000-0000-0000-0000-000000000002';
const setlistId = '00000000-0000-0000-0000-000000000003';
const flush = () => new Promise(resolve => setImmediate(resolve));
function clientHarness() {
  let currentUser = user1;
  const listeners = new Map<string, (...args: any[]) => void>();
  const calls: { name: string; args?: any }[] = [];
  let permission = 'prompt';
  let registrationGate: Promise<void> | undefined;
  const pushes = {
    addListener: async (name: string, callback: any) => { listeners.set(name, callback); return { remove: async () => { if (listeners.get(name) === callback) listeners.delete(name); } }; },
    checkPermissions: async () => ({ receive: permission }),
    requestPermissions: async () => { calls.push({ name: 'permission' }); permission = 'granted'; return { receive: permission }; },
    register: async () => { calls.push({ name: 'native-register' }); listeners.get('registration')?.({ value: 'test-token-for-installation-123456789' }); },
    unregister: async () => { calls.push({ name: 'native-unregister' }); },
    removeAllDeliveredNotifications: async () => {}, createChannel: async () => {},
  };
  const db = { auth: { getUser: async () => ({ data: { user: { id: currentUser } } }) }, rpc: async (name: string, args: any) => { calls.push({ name, args }); if (name === 'register_push_device') await registrationGate; return { error: null }; } };
  const storage = new Map<string, string>();
  const exports: any = {};
  const source = fs.readFileSync('src/services/assignmentNotifications.ts', 'utf8').replace("import.meta.env.VITE_ANDROID_PUSH_CONFIGURED", "'true'");
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, crypto: webcrypto, localStorage: { getItem: (key: string) => storage.get(key) || null, setItem: (key: string, value: string) => storage.set(key, value) },
    require: (name: string) => name === '@capacitor/core' ? { Capacitor: { getPlatform: () => 'android' } } : name === '@capacitor/push-notifications' ? { PushNotifications: pushes } : { supabase: db },
  });
  return { exports, listeners, calls, blockRegistration: () => { let release: () => void; registrationGate = new Promise<void>(resolve => { release = resolve; }); return () => release!(); }, setUser: (id: string) => { currentUser = id; }, setPermission: (value: string) => { permission = value; } };
}
test('Android registration requires permission and successful account-bound persistence; wrong-account taps are ignored', async () => {
  const h = clientHarness(); const opened: string[] = []; const statuses: string[] = [];
  const stop = await h.exports.listenForAssignmentPush(user1, (id: string) => opened.push(id), () => {}, (status: string) => statuses.push(status));
  assert.deepEqual(statuses, ['prompt']);
  assert.equal(h.calls.some(call => call.name === 'permission'), false, 'opening the app must not auto-prompt');
  await h.exports.enableAssignmentPush(); await flush(); await flush();
  assert.ok(h.calls.some(call => call.name === 'register_push_device'));
  assert.equal(statuses.at(-1), 'enabled');
  h.listeners.get('pushNotificationActionPerformed')!({ notification: { data: { userId: user2, setlistId } } });
  assert.equal(opened.length, 0);
  h.listeners.get('pushNotificationActionPerformed')!({ notification: { data: { userId: user1, setlistId: 'bad-id' } } });
  assert.equal(opened.length, 0);
  h.listeners.get('pushNotificationActionPerformed')!({ notification: { data: { userId: user1, setlistId } } });
  assert.deepEqual(opened, [setlistId]);
  const oldRegistration = h.listeners.get('registration')!;
  stop(); h.setUser(user2);
  const count = h.calls.filter(call => call.name === 'register_push_device').length;
  oldRegistration({ value: 'stale-registration-token-123456789' }); await flush();
  assert.equal(h.calls.filter(call => call.name === 'register_push_device').length, count, 'stale account callbacks cannot register a device');
  await h.exports.disableAssignmentPush();
  assert.ok(h.calls.some(call => call.name === 'unregister_push_device'));
  assert.ok(h.calls.some(call => call.name === 'native-unregister'));
});
test('logout waits for an in-flight registration before revoking the installation', async () => {
  const h = clientHarness();
  const release = h.blockRegistration();
  const stop = await h.exports.listenForAssignmentPush(user1, () => {}, () => {}, () => {});
  await h.exports.enableAssignmentPush(); await flush();
  const logout = h.exports.disableAssignmentPush(); await flush();
  assert.equal(h.calls.some(call => call.name === 'unregister_push_device'), false, 'revocation must follow an already-started registration');
  release(); await logout;
  const names = h.calls.map(call => call.name);
  assert.ok(names.indexOf('unregister_push_device') > names.indexOf('register_push_device'));
  stop();
});
test('denied notification permission never registers a token', async () => {
  const h = clientHarness(); h.setPermission('denied');
  assert.equal(await h.exports.enableAssignmentPush(), 'denied');
  assert.equal(h.calls.some(call => call.name === 'native-register'), false);
});
test('announcement pushes refresh and open the inbox only for their own account', async () => {
  const h = clientHarness(); let refreshed = 0, opened = 0;
  const stop = await h.exports.listenForAssignmentPush(user1, () => assert.fail('An announcement has no setlist'), () => refreshed++, () => {}, () => opened++);
  const data = { userId: user1, kind: 'announcement', notificationId: setlistId };
  h.listeners.get('pushNotificationReceived')!({ data });
  assert.equal(refreshed, 1);
  h.listeners.get('pushNotificationActionPerformed')!({ notification: { data: { ...data, userId: user2 } } });
  h.listeners.get('pushNotificationActionPerformed')!({ notification: { data: { ...data, notificationId: 'bad-id' } } });
  assert.equal(opened, 0);
  h.listeners.get('pushNotificationActionPerformed')!({ notification: { data } });
  assert.equal(opened, 1); assert.equal(refreshed, 2); stop();
});
function workerHarness(secrets: Record<string, string>, rpc: (name: string, args: any) => Promise<any>, fetcher: typeof fetch) {
  let handler: (request: Request) => Promise<Response>;
  const source = fs.readFileSync('supabase/functions/assignment-notifications/index.ts', 'utf8');
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports: {}, Request, Response, TextEncoder, Uint8Array, crypto: webcrypto, URLSearchParams, AbortSignal, btoa, atob, fetch: fetcher,
    Deno: { env: { get: (name: string) => secrets[name] }, serve: (callback: any) => { handler = callback; } },
    require: () => ({ createClient: () => ({ rpc }) }),
  });
  return (request: Request) => handler!(request);
}
test('notification dispatcher rejects unauthenticated requests without sending messages', async () => {
  let outbound = 0;
  const handler = workerHarness({ NOTIFICATIONS_CRON_SECRET: 'test-server-secret' }, async () => { throw new Error('No database work allowed'); }, (async () => { outbound++; throw new Error('No requests allowed'); }) as any);
  assert.equal((await handler(new Request('https://example.test', { method: 'GET' }))).status, 405);
  assert.equal((await handler(new Request('https://example.test', { method: 'POST' }))).status, 401);
  assert.equal(outbound, 0);
});
test('dispatcher sends only claimed device deliveries and acknowledges provider outcomes', async () => {
  const keys = await webcrypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1,0,1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const privateKey = Buffer.from(await webcrypto.subtle.exportKey('pkcs8', keys.privateKey)).toString('base64');
  const account = { client_email: 'test@example.test', project_id: 'test-project', private_key: `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----` };
  for (const outcome of ['sent', 'retry', 'invalid']) for (const standalone of [false, true]) {
    const acknowledgements: any[] = [];
    const handler = workerHarness({ NOTIFICATIONS_CRON_SECRET: 'test-server-secret', FCM_SERVICE_ACCOUNT_JSON: JSON.stringify(account) }, async (name, args) => {
      if (name === 'claim_assignment_pushes') return { data: [{ delivery_id: 1, lease_id: setlistId, notification_id: setlistId, token: 'test-device-token', user_id: user1, setlist_id: standalone ? null : setlistId, title: 'Assignment', body: 'Assigned for Sunday' }], error: null };
      acknowledgements.push(args); return { error: null };
    }, (async (url: any, options: any) => {
      if (String(url).includes('oauth2.googleapis.com')) return Response.json({ access_token: 'test-access-token', expires_in: 3600 });
      const payload = JSON.parse(options.body);
      assert.equal(payload.message.data.userId, user1); assert.equal(payload.message.data.setlistId, standalone ? undefined : setlistId);
      if (standalone) assert.equal(payload.message.data.kind, 'announcement');
      assert.equal(payload.message.android.notification.tag, setlistId);
      if (outcome === 'sent') return Response.json({ name: 'messages/test' });
      return Response.json({ error: { details: outcome === 'invalid' ? [{ errorCode: 'UNREGISTERED' }] : [] } }, { status: outcome === 'invalid' ? 404 : 503 });
    }) as any);
    const response = await handler(new Request('https://example.test', { method: 'POST', headers: { 'x-notification-secret': 'test-server-secret' } }));
    assert.equal(response.status, 200); assert.equal(acknowledgements[0].result, outcome);
  }
});

function accountHandler(kind: 'create' | 'update') {
  let handler: (request: Request) => Promise<Response>;
  const recorded: any[] = [];
  const personId = '00000000-0000-0000-0000-000000000010';
  const admin = {
    auth: { getUser: async () => ({ data: { user: { id: user1 } } }), admin: {
      getUserById: async () => ({ data: { user: { id: user2, app_metadata: { directory_member_id: personId, provider: 'email' } } } }),
      createUser: async (payload: any) => { recorded.push(payload); return { data: { user: { id: user2 } }, error: null }; },
      updateUserById: async (_id: string, payload: any) => { recorded.push(payload); return { error: null }; },
    } },
    from: (table: string) => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: table === 'profiles' ? { active: true, role: 'admin' } : { id: personId, name: 'Canonical directory name', active: true }, error: null }) }),
  };
  const source = fs.readFileSync(`supabase/functions/admin-${kind}-user/index.ts`, 'utf8');
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports: {}, Request, Response, Deno: { env: { get: () => 'test-value' }, serve: (callback: any) => { handler = callback; } }, require: () => ({ createClient: () => admin }),
  });
  return { personId, recorded, call: (body: any) => handler!(new Request('https://example.test', { method: 'POST', headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' }, body: JSON.stringify(body) })) };
}
test('older Android APKs can create unlinked accounts without guessing directory identity', async () => {
  const h = accountHandler('create');
  assert.equal((await h.call({ username: 'legacy_user', displayName: 'Legacy name', password: 'test-password' })).status, 200);
  assert.equal(h.recorded[0].user_metadata.display_name, 'Legacy name');
  assert.equal(h.recorded[0].app_metadata.directory_member_id, undefined);
});
test('new account requests use the canonical directory identity', async () => {
  const h = accountHandler('create');
  assert.equal((await h.call({ username: 'new_user', displayName: 'Ignored guess', directoryMemberId: h.personId, password: 'test-password' })).status, 200);
  assert.equal(h.recorded[0].user_metadata.display_name, 'Canonical directory name');
  assert.equal(h.recorded[0].app_metadata.directory_member_id, h.personId);
});
test('older APK account edits preserve existing directory links and provider metadata', async () => {
  const h = accountHandler('update');
  assert.equal((await h.call({ userId: user2, username: 'updated_user', displayName: 'Ignored old-client name' })).status, 200);
  assert.equal(h.recorded[0].app_metadata.directory_member_id, h.personId);
  assert.equal(h.recorded[0].app_metadata.provider, 'email');
  assert.equal(h.recorded[0].user_metadata.display_name, 'Canonical directory name');
});
