import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

test('practice downloads create private folders, detect recordings, and keep failed files out of the mixer', async () => {
  const files = new Map<string, number>();
  const directories = new Set<string>();
  const uri = (path: string) => 'file:///private/' + path;
  const filesystem = {
    async readdir({ path }: { path: string }) {
      const entries = new Map();
      for (const [key, size] of files) {
        if (!key.startsWith(path + '/')) continue;
        const [name, child] = key.slice(path.length + 1).split('/');
        entries.set(name, { name, size, type: child ? 'directory' : 'file', uri: uri(key) });
      }
      return { files: [...entries.values()] };
    },
    async mkdir({ directory, path }: { directory: string; path: string }) {
      assert.equal(directory, 'DATA');
      directories.add(path);
    },
    async downloadFile({ path }: { path: string }) {
      assert.ok(directories.has(path.slice(0, path.lastIndexOf('/'))));
      files.set(path, 200);
    },
    async stat({ path }: { path: string }) { return { uri: uri(path), size: files.get(path) }; },
    async getUri({ path }: { path: string }) { return { uri: uri(path) }; },
    async rename({ from, to }: { from: string; to: string }) {
      files.set(to, files.get(from)!);
      files.delete(from);
    },
    async deleteFile({ path }: { path: string }) { files.delete(path); },
  };
  let playable = true;
  class Audio {
    onloadedmetadata?: () => void;
    onerror?: () => void;
    set src(src: string) {
      assert.match(src, /\.pending\.webm$/);
      queueMicrotask(() => (playable ? this.onloadedmetadata : this.onerror)?.());
    }
    removeAttribute() {}
    load() {}
  }
  const exports: Record<string, any> = {};
  const code = readFileSync('src/services/practiceDownloads.ts', 'utf8');
  runInNewContext(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, window: { setTimeout, clearTimeout }, Audio, AbortSignal,
    require: (id: string) => id === '@capacitor/core'
      ? { Capacitor: { convertFileSrc: (source: string) => source } }
      : { Filesystem: filesystem, Directory: { Data: 'DATA' } },
    fetch: async () => new Response(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0])),
  });

  const track = { accountId: 'member', practiceId: 'practice-1', songTitle: 'Born Again', trackId: 'voice-1' };
  const saved = await exports.downloadPracticeTrack(track, 'https://example.com/extensionless');
  assert.equal(saved.path, 'Practice/member/Born Again--practice-1/voice-1.webm');
  assert.equal((await exports.findPracticeDownload({ ...track, songTitle: 'Renamed' })).path, saved.path);
  assert.equal(await exports.findPracticeDownload({ ...track, accountId: 'other' }), null);

  playable = false;
  await assert.rejects(exports.downloadPracticeTrack({ ...track, trackId: 'invalid' }, 'https://example.com/invalid'));
  assert.deepEqual([...files.keys()], [saved.path]);
  await exports.removePracticeDownload(saved.path);
  assert.equal(await exports.findPracticeDownload(track), null);
});
