import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function fixture(options: { failedTable?: string; missingAudio?: boolean; changed?: boolean; admin?: boolean; remote?: boolean } = {}) {
  const tables: Record<string, any[]> = {
    songs: Array.from({ length: 1105 }, (_, i) => ({ id: String(i), lyrics: 'Verse\n\nChorus', categories: ['Hymn'], url: 'https://example.com/song' })),
    church_activities: [{ id: 'event', description: 'First\nSecond' }],
    attachments: [{ id: 'audio', external_url: options.remote ? 'https://pub-aaa45e93104541548f563b3496acae00.r2.dev/recording' : 'indexeddb:recording' }],
  };
  const reads: Record<string, number> = {};
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: 'admin' } } }) },
    from(table: string) {
      return { select() { return this; }, eq() { return this; },
        single: async () => ({ data: { active: true, role: options.admin === false ? 'user' : 'admin' } }),
        order() { return this; },
        async range(start: number, end: number) {
          reads[table] = (reads[table] || 0) + 1;
          if (table === options.failedTable) return { error: { message: 'offline' } };
          const data = (tables[table] || []).slice(start, end + 1);
          if (options.changed && table === 'church_activities' && reads[table] > 1) return { data: [] };
          return { data };
        },
      };
    },
  };
  const exports: any = {};
  const source = readFileSync('src/services/backup.ts', 'utf8');
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, AbortSignal, fetch: async () => ({ ok: !options.missingAudio, blob: async () => new Blob(['a']) }),
      FileReader: class {
        result = 'data:audio/webm;base64,YQ==';
        onload?: () => void;
        readAsDataURL() { this.onload?.(); }
      }, require: (name: string) => name === '../supabase' ? { supabase } : {
      getAudioFromStorage: async () => options.missingAudio ? null : 'data:audio/webm;base64,YQ==',
    } });
  return () => exports.createFullBackup(() => {});
}

test('backup fetches all pages and unopened collections, retaining lyrics, categories, links and recordings', async () => {
  const result = await fixture()();
  assert.equal(result.tables.songs.length, 1105);
  assert.equal(result.tables.songs[0].lyrics, 'Verse\n\nChorus');
  assert.equal(result.tables.songs[0].categories[0], 'Hymn');
  assert.equal(result.tables.church_activities[0].description, 'First\nSecond');
  assert.ok(result.tables.sermon_outlines);
  assert.equal(result.assets['indexeddb:recording'], 'data:audio/webm;base64,YQ==');
  assert.equal(result.externalLinks[0], 'https://example.com/song');
});
test('backup fails visibly on a failed collection or missing recording', async () => {
  await assert.rejects(fixture({ failedTable: 'songs' }), /Backup stopped at songs/);
  await assert.rejects(fixture({ missingAudio: true }), /Recording unavailable/);
});
test('backup rejects a changing dataset and non-admin access', async () => {
  await assert.rejects(fixture({ changed: true }), /data changed during backup/);
  await assert.rejects(fixture({ admin: false }), /Administrator access required/);
});
test('backup embeds owned R2 recordings and stops if their download fails', async () => {
  const result = await fixture({ remote: true })();
  const url = 'https://pub-aaa45e93104541548f563b3496acae00.r2.dev/recording';
  assert.equal(result.assets[url], 'data:audio/webm;base64,YQ==');
  assert.ok(!result.externalLinks.includes(url));
  await assert.rejects(fixture({ remote: true, missingAudio: true }), /Recording download failed/);
});
