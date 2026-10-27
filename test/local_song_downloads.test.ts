import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
import * as model from '../src/features/downloads/model.ts';
import { resolveMediaUrl } from '../src/utils/mediaUtils.ts';

function harness({ android = false, initial = [], failSave = false, failLyrics = false }: { android?: boolean; initial?: any[]; failSave?: boolean; failLyrics?: boolean } = {}) {
  const exports: any = {}, records = [...initial]; let saves = 0, fetches = 0, nativeCalls = 0, releases = 0, resolveNative: any, nativeProgress: any;
  const storage = {
    listWebFiles: async () => records,
    saveWebFile: async (record: any) => { saves++; if (failSave) throw new Error('Storage full'); records.push(record); },
    removeWebFile: async (id: string) => { const index = records.findIndex(x => x.id === id); if (index >= 0) records.splice(index, 1); },
    readWebFile: async () => new Blob(['audio'], { type: 'audio/mpeg' }),
    cacheDownloadedSongs: async () => { if (failLyrics) throw new Error('Lyrics could not be saved'); },
  };
  const native = {
    list: async () => ({ items: records }),
    download: async () => { nativeCalls++; return new Promise(resolve => { resolveNative = resolve; }); },
    remove: storage.removeWebFile,
    cancel: async () => {},
    addListener: async (_: string, callback: any) => { nativeProgress = callback; return { remove() {} }; },
  };
  runInNewContext(ts.transpileModule(readFileSync('src/features/downloads/service.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, console, URL: Object.assign(class extends URL {}, { createObjectURL: () => 'blob:offline-audio', revokeObjectURL: () => releases++ }),
    Blob, Response, Uint8Array, TextEncoder, AbortController, DOMException, crypto: webcrypto,
    navigator: { storage: { persist: async () => true } },
    fetch: async () => { fetches++; return new Response(new Uint8Array([73, 68, 51, 4]), { headers: { 'content-type': 'audio/mpeg', 'content-length': '4' } }); },
    require: (name: string) => name === '@capacitor/core' ? { Capacitor: { getPlatform: () => android ? 'android' : 'web', isNativePlatform: () => android, convertFileSrc: (path: string) => `local:${path}` }, registerPlugin: () => native } : name === './storage' ? storage : name === './model' ? model : { resolveMediaUrl },
  });
  return { api: exports, stats: () => ({ saves, fetches, nativeCalls, releases }), resolveNative: (record: any) => resolveNative(record), progress: (progress: any) => nativeProgress(progress) };
}
const source = { url: 'https://media.example.test/song.mp3', type: 'audio', title: 'Song backing track', songId: 'song-1' };

test('YouTube variants share a single local key; unrelated hosts, credentials and playlists are not video IDs', () => {
  const expected = 'https://www.youtube.com/watch?v=abcdefghijk';
  for (const url of ['https://youtu.be/abcdefghijk?t=42', 'https://www.youtube.com/watch?v=abcdefghijk&list=ignored', 'https://www.youtube.com/shorts/abcdefghijk', 'https://m.youtube.com/watch?v=abcdefghijk']) assert.equal(model.sourceKey(url), expected);
  assert.equal(model.youtubeVideoId('https://youtube.com.evil.test/watch?v=abcdefghijk'), null);
  assert.equal(model.canDownload({ ...source, type: 'link', url: 'https://example.test/page' }), false);
  assert.equal(model.sourceKey('https://user:password@media.example.test/file.mp3'), null);
  assert.equal(model.sourceKey('http://media.example.test/file.mp3'), null);
});

test('Local files filter and song size/date sorting stay connected to attachment URLs, including shared tracks', () => {
  const file: model.LocalSongFile = { id: 'file', sourceKey: model.sourceKey('https://youtu.be/abcdefghijk')!, sourceUrl: '', songId: 'different-song', title: '', fileName: 'video.mp4', type: 'video', size: 1024, downloadedAt: '2026-10-27T01:00:00Z' };
  const song = { id: 'song', updatedAt: '2026-10-27', title: 'Lyrics title', lyrics: 'VERSE 1\nLyrics', minusOneLink: 'https://youtube.com/watch?v=abcdefghijk&t=12', attachments: [{ id: 'same', name: '', urlOrData: 'https://youtu.be/abcdefghijk', type: 'link' as const }] };
  assert.deepEqual(model.localSongStats(song, [file]), { count: 1, size: 1024, latest: file.downloadedAt });
  assert.equal(model.localSongStats({ ...song, minusOneLink: undefined, attachments: [] }, [file]).count, 0);
});

test('browser download is stored before success, duplicate clicks share one request, and local playback makes no network call', async () => {
  const h = harness(); const first = h.api.downloadSongFile(source), second = h.api.downloadSongFile(source);
  assert.equal(first, second); await first;
  assert.equal(h.stats().fetches, 1); assert.equal(h.stats().saves, 1);
  const snapshot = h.api.getDownloadSnapshot(); assert.equal(snapshot.items.length, 1); assert.equal(snapshot.jobs[source.url].progress, 100);
  const local = await h.api.openLocalSongFile(snapshot.items[0]); assert.equal(local.url, 'blob:offline-audio'); assert.equal(h.stats().fetches, 1);
  local.release(); assert.equal(h.stats().releases, 1);
  await h.api.removeSongDownload(snapshot.items[0]); assert.equal(h.api.getDownloadSnapshot().items.length, 0);
});

test('storage and offline lyrics failures do not mark a track downloaded', async () => {
  for (const options of [{ failSave: true }, { failLyrics: true }]) {
    const h = harness(options); await h.api.downloadSongFile({ ...source, song: { id: 'song-1', title: 'Title', lyrics: 'Lyrics' } });
    const snapshot = h.api.getDownloadSnapshot(); assert.equal(snapshot.items.length, 0); assert.equal(snapshot.jobs[source.url].running, false); assert.ok(snapshot.jobs[source.url].error);
    if (options.failLyrics) assert.equal(h.stats().fetches, 0);
  }
});

test('Android video download waits for native completion and restores local playback from saved native records', async () => {
  const h = harness({ android: true }); const url = 'https://youtu.be/abcdefghijk'; const key = model.sourceKey(url)!;
  const promise = h.api.downloadSongFile({ ...source, url, type: 'link' });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(h.stats().nativeCalls, 1); assert.equal(h.api.getDownloadSnapshot().items.length, 0);
  h.progress({ sourceKey: key, progress: 42, stage: 'Downloading video' }); assert.equal(h.api.getDownloadSnapshot().jobs[key].progress, 42);
  const file = { id: 'file', sourceKey: key, type: 'video', uri: 'file:///private/song.mp4', downloadedAt: 'today', size: 100 };
  h.resolveNative(file); await promise; assert.equal(h.api.getDownloadSnapshot().items.length, 1);
  const reopened = harness({ android: true, initial: [file] }); await reopened.api.refreshDownloads();
  const local = await reopened.api.openLocalSongFile(reopened.api.getDownloadSnapshot().items[0]); assert.equal(local.url, 'local:file:///private/song.mp4'); assert.equal(reopened.stats().fetches, 0);
});

test('web YouTube links report the Android requirement rather than saving an HTML webpage as a media file', async () => {
  const h = harness(); await h.api.downloadSongFile({ ...source, type: 'link', url: 'https://youtu.be/abcdefghijk' });
  assert.equal(h.stats().fetches, 0); assert.equal(h.api.getDownloadSnapshot().items.length, 0);
  assert.match(h.api.getDownloadSnapshot().jobs[model.sourceKey('https://youtu.be/abcdefghijk')!].error, /Android app/);
});
