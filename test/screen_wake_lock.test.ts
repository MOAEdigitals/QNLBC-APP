import assert from 'node:assert/strict';
import test from 'node:test';
import { keepScreenAwake, type ScreenLock } from '../src/utils/screenWakeLock.ts';

function fakePage() {
  let listener: (() => void) | undefined;
  return {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: (_type: string, next: () => void) => { listener = next; },
    removeEventListener: () => { listener = undefined; },
    changeVisibility(value: DocumentVisibilityState) {
      this.visibilityState = value;
      listener?.();
    },
  };
}

test('lyrics view requests and releases a screen wake lock', async () => {
  const page = fakePage();
  let releases = 0;
  const statuses: string[] = [];
  const lock: ScreenLock = {
    release: async () => { releases += 1; },
    addEventListener: () => {},
  };
  const controller = keepScreenAwake(async () => lock, page, (status) => statuses.push(status));
  await Promise.resolve();
  assert.deepEqual(statuses, ['requesting', 'active']);
  controller.stop();
  assert.equal(releases, 1);
});

test('wake lock is reacquired when a lyrics view becomes visible again', async () => {
  const page = fakePage();
  let requests = 0;
  const locks: ScreenLock[] = [];
  const controller = keepScreenAwake(async () => {
    requests += 1;
    const lock: ScreenLock = { release: async () => {}, addEventListener: () => {} };
    locks.push(lock);
    return lock;
  }, page, () => {});
  await Promise.resolve();
  page.changeVisibility('hidden');
  page.changeVisibility('visible');
  await Promise.resolve();
  assert.equal(requests, 2);
  controller.stop();
});
