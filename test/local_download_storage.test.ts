import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function storage() {
  const committed: Record<string, Map<string, any>> = { files: new Map(), records: new Map(), songs: new Map() };
  let pending: any;
  const database = {
    transaction: (_: any, mode?: string) => {
      const operations: Array<() => void> = []; const transaction: any = { objectStore: (name: string) => ({
        put: (value: any, key?: string) => operations.push(() => committed[name].set(key || value.id, value)),
        delete: (key: string) => operations.push(() => committed[name].delete(key)),
        get: (key: string) => { const req: any = {}; queueMicrotask(() => { req.result = committed[name].get(key); req.onsuccess(); }); return req; },
        getAll: () => { const req: any = {}; queueMicrotask(() => { req.result = [...committed[name].values()]; req.onsuccess(); }); return req; },
      }) };
      if (mode === 'readwrite') pending = { commit: () => { operations.forEach(operation => operation()); transaction.oncomplete(); }, abort: () => transaction.onabort() };
      return transaction;
    },
  };
  const exports: any = {};
  runInNewContext(ts.transpileModule(readFileSync('src/features/downloads/storage.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Blob, console, indexedDB: { open: () => { const request: any = { result: database }; queueMicrotask(() => request.onsuccess()); return request; } },
  });
  return { api: exports, transaction: () => pending };
}
async function tick() { await new Promise(resolve => setTimeout(resolve, 0)); }

test('a browser download is committed atomically with metadata and survives reopening, then removing it deletes both', async () => {
  const h = storage(); const record = { id: 'id', title: 'Title', size: 3 }, blob = new Blob(['mp3']); let saved = false;
  const save = h.api.saveWebFile(record, blob).then(() => { saved = true; }); await tick();
  assert.equal(saved, false); assert.equal((await h.api.listWebFiles()).length, 0);
  h.transaction().commit(); await save; assert.equal(saved, true); assert.equal((await h.api.listWebFiles())[0].id, 'id');
  assert.equal(await (await h.api.readWebFile('id')).text(), 'mp3');
  const remove = h.api.removeWebFile('id'); await tick(); h.transaction().commit(); await remove;
  assert.equal((await h.api.listWebFiles()).length, 0); await assert.rejects(h.api.readWebFile('id'), /missing/);
});

test('an aborted storage transaction leaves no false Downloaded record or half-saved file', async () => {
  const h = storage(); const pending = h.api.saveWebFile({ id: 'id' }, new Blob(['audio']));
  const rejected = assert.rejects(pending, /storage|saved/); await tick(); h.transaction().abort(); await rejected;
  assert.equal((await h.api.listWebFiles()).length, 0); await assert.rejects(h.api.readWebFile('id'), /missing/);
});

test('offline lyric snapshots preserve lyrics and omit inline media bytes and unrelated account fields', async () => {
  const h = storage();
  const pending = h.api.cacheDownloadedSongs([{ id: 'song', title: 'Title', lyrics: 'VERSE 1\n\nOriginal lyrics', updatedAt: 'today', secret: 'not a song field', attachments: [{ id: 'large', type: 'audio', urlOrData: 'data:audio/mpeg;base64,LARGE' }, { id: 'web', type: 'audio', urlOrData: 'https://media.test/audio.mp3' }] }]);
  await tick(); h.transaction().commit(); await pending; const snapshot = (await h.api.readDownloadedSongs())[0];
  assert.equal(snapshot.lyrics, 'VERSE 1\n\nOriginal lyrics'); assert.equal(snapshot.secret, undefined); assert.equal(snapshot.attachments.length, 1); assert.equal(snapshot.attachments[0].id, 'web');
});
