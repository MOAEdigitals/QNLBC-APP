import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function fixture() {
  const source = readFileSync('src/services/supabaseData.ts', 'utf8');
  const section = source.slice(source.indexOf('function mapSavedSetlist('), source.indexOf('export async function deleteSetlist('));
  const calls: any[] = [];
  let fails = true;
  let sequence = 0;
  const exports: any = {};
  runInNewContext(ts.transpileModule(section, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, isSupabaseConfigured: () => true,
    isUUID: (value: unknown) => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value),
    generateUUID: () => `request-${++sequence}`,
    supabase: { rpc: async (name: string, payload: any) => {
      calls.push({ name, payload });
      if (fails) return { error: { message: 'Response lost' } };
      return { data: { parent: { id: 'database-id', revision: 2, service_date: '2026-10-08', type: 'sunday' },
        items: [{ id: 'child-id', section: 'worship', position: 0, song_title: 'Saved title', lyrics_mode: 'snapshot', lyrics_snapshot: 'Verse\nChorus' }] } };
    } },
  });
  return { calls, save: exports.saveSetlist, succeed: () => { fails = false; } };
}

test('setlist retry reuses its request ID after an unconfirmed save', async () => {
  const f = fixture();
  const draft = { id: '11111111-1111-4111-8111-111111111111', date: '2026-10-08', worshipService: { songs: [{ title: 'Draft title' }] } };
  await assert.rejects(() => f.save(draft, true), /Response lost/);
  f.succeed();
  const saved = await f.save(draft, true);
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[0].name, 'save_setlist_atomic');
  assert.equal(f.calls[0].payload.request_id, f.calls[1].payload.request_id);
  assert.equal(f.calls[1].payload.creating, true);
  assert.equal(saved.id, 'database-id');
  assert.equal(saved.worshipService.songs[0].title, 'Saved title');
  assert.equal(saved.worshipService.songs[0].lyricsSnapshot, 'Verse\nChorus');
});

test('changed drafts use a new receipt and include the expected revision', async () => {
  const f = fixture();
  const draft = { id: '11111111-1111-4111-8111-111111111111', revision: 7, date: '2026-10-08' };
  await assert.rejects(() => f.save(draft, false));
  f.succeed();
  await f.save({ ...draft, title: 'Changed title' }, false);
  assert.notEqual(f.calls[0].payload.request_id, f.calls[1].payload.request_id);
  assert.equal(f.calls[1].payload.expected_revision, 7);
  assert.equal(f.calls[1].payload.creating, false);
});
