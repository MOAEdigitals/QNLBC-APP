import test from 'node:test';
import assert from 'node:assert/strict';
import { hasNewUnreadNotifications, notificationSoundEnabled, setNotificationSoundEnabled, playNotificationSound, unlockNotificationSound } from '../src/utils/notificationSound.ts';

test('only unseen unread notifications received after sign-in trigger a chime', () => {
  const started = Date.parse('2026-10-31T00:00:00Z');
  const rows = [{ id: 'new', read_at: null, created_at: '2026-10-31T00:01:00Z' }];
  assert.equal(hasNewUnreadNotifications(rows, null, started), false, 'initial inbox stays silent');
  assert.equal(hasNewUnreadNotifications(rows, new Set(), started), true);
  assert.equal(hasNewUnreadNotifications(rows, new Set(['new']), started), false, 'refresh and mark-read do not repeat sound');
  assert.equal(hasNewUnreadNotifications([{ ...rows[0], read_at: 'read' }], new Set(), started), false);
  assert.equal(hasNewUnreadNotifications([{ ...rows[0], created_at: '2026-10-30T23:59:59Z' }], new Set(), started), false);
});

test('chime is light, respects account mute and hidden pages, and supports an explicit sound test', async () => {
  const names = ['window', 'document', 'localStorage'], old = names.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  const values = new Map(); let tones = 0;
  class Context {
    state = 'running'; currentTime = 0; destination = {};
    async resume() { this.state = 'running'; }
    createOscillator() { return { frequency: { value: 0 }, connect() {}, disconnect() {}, start() { tones++; }, stop() {}, onended: null }; }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
  }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { AudioContext: Context } });
  const doc = { visibilityState: 'visible' };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => values.get(key), setItem: (key: string, value: string) => values.set(key, value) } });
  try {
    assert.equal(notificationSoundEnabled('member'), true);
    assert.equal(await playNotificationSound('member'), false, 'no audio before user interaction');
    await unlockNotificationSound();
    assert.equal(await playNotificationSound('member', true), true); assert.equal(tones, 2);
    setNotificationSoundEnabled('member', false);
    assert.equal(notificationSoundEnabled('other'), true, 'mute preference belongs to this account');
    assert.equal(await playNotificationSound('member', true), false);
    doc.visibilityState = 'hidden'; assert.equal(await playNotificationSound('other'), false);
    assert.equal(tones, 2);
  } finally { names.forEach((key, i) => { if (old[i]) Object.defineProperty(globalThis, key, old[i]!); else delete (globalThis as any)[key]; }); }
});
