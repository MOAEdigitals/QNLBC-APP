import assert from 'assert';
import { describe, it, beforeEach } from 'node:test';

// In-memory localStorage mock for testing
class MemoryStorage {
  private store: Record<string, string> = {};
  getItem(key: string) { return this.store[key] || null; }
  setItem(key: string, val: string) { this.store[key] = String(val); }
  removeItem(key: string) { delete this.store[key]; }
  clear() { this.store = {}; }
}

(globalThis as any).localStorage = new MemoryStorage();

// Dynamic import after localStorage is mocked
const {
  sanitizeDoc,
  enqueuePending,
  dequeuePending,
  getPendingQueue,
  savePendingQueue,
  recordTombstone,
  isItemTombstoned,
  removeTombstone,
} = await import('../src/firestoreSync');

describe('Firestore Sync Module Unit Tests', () => {
  beforeEach(() => {
    (globalThis as any).localStorage.clear();
  });

  it('sanitizeDoc leaves large data URLs without turning them into generic strings', () => {
    const dataUrl = 'data:audio/mp3;base64,' + 'B'.repeat(120000);
    const doc = { title: 'Test', audio: dataUrl, meta: { notes: 'Praise' } };
    const clean = sanitizeDoc(doc);
    assert.strictEqual(clean.audio, dataUrl);
    assert.strictEqual(clean.title, 'Test');
    assert.strictEqual(clean.meta.notes, 'Praise');
  });

  it('Queue retains more than 50 items without truncation', () => {
    savePendingQueue([]);
    for (let i = 0; i < 60; i++) {
      enqueuePending('songs', `song_${i}`, { title: `Song ${i}` }, 'write', `op_${i}`);
    }
    const q = getPendingQueue();
    assert.strictEqual(q.length, 60, 'Queue must hold all 60 items');
    assert.strictEqual(q[0].opId, 'op_0', 'First item must not be truncated');
    assert.strictEqual(q[59].opId, 'op_59', 'Last item must be present');
  });

  it('Dequeuing by opId only removes the matching operation', () => {
    savePendingQueue([]);
    const op1 = enqueuePending('songs', 'song-same', { title: 'v1' }, 'write', 'op_1');
    const op2 = enqueuePending('songs', 'song-same', { title: 'v2' }, 'write', 'op_2');

    assert.strictEqual(getPendingQueue().length, 2);
    dequeuePending(op1);

    const remaining = getPendingQueue();
    assert.strictEqual(remaining.length, 1);
    assert.strictEqual(remaining[0].opId, op2);
    assert.strictEqual(remaining[0].data?.title, 'v2');
  });

  it('Tombstones record deletions and prevent resurrection', () => {
    recordTombstone('songs', 'song-del-99');
    assert.strictEqual(isItemTombstoned('songs', 'song-del-99'), true);
    assert.strictEqual(isItemTombstoned('songs', 'song-active-1'), false);

    // After explicit remove, tombstone is lifted
    removeTombstone('songs', 'song-del-99');
    assert.strictEqual(isItemTombstoned('songs', 'song-del-99'), false);
  });
});

setTimeout(() => {
  process.exit(0);
}, 200);

