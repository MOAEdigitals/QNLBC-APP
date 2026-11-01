import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function fixture(updateResult: any, reload?: (payload: any) => any) {
  const source = fs.readFileSync('src/services/supabaseData.ts', 'utf8');
  const fn = source.slice(source.indexOf('export async function saveSong('), source.indexOf('export async function deleteSong('));
  let queries = 0, payload: any;
  const filters: any[] = [], exports: any = {};
  const supabase = { from: () => {
    const index = queries++;
    const query: any = { select: () => query, update: (value: any) => { payload = value; return query; }, eq: (...args: any[]) => { filters.push(args); return query; }, single: async () => ({ data: { title: 'Mananatili', metadata: {} }, error: null }), maybeSingle: async () => index === 1 ? updateResult : reload!(payload) };
    return query;
  } };
  const identity = (value: any) => value;
  runInNewContext(ts.transpileModule(fn, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, supabase, isSupabaseConfigured: () => true, isUUID: () => true, mapSongFromDB: identity, cleanLeadingSongTitle: (_: any, value: any) => value, cleanEmptySectionLabels: identity, cleanDuplicateChorusSections: identity, ConcurrencyConflictError: class extends Error {} });
  return { save: () => exports.saveSong({ id: 'song-id', title: 'Mananatili', lyrics: 'Existing lyrics', categories: ['Tagalog', 'Contemporary'], category: 'Tagalog, Contemporary', revision: 2 }), filters };
}

test('song update verifies a missing response row without ignoring the revision guard', async () => {
  const f = fixture({ data: null, error: null }, payload => ({ data: { ...payload, id: 'song-id', revision: 3, deleted_at: null, metadata: { attachments: [], previousTitles: [] } }, error: null }));
  const saved = await f.save();
  assert.deepEqual(Array.from(saved.categories), ['Tagalog', 'Contemporary']);
  assert.ok(f.filters.some(([key, value]) => key === 'revision' && value === 2));
});

test('song update rejects stale, missing or differently edited rows instead of reporting a false success', async () => {
  for (const reload of [() => ({ data: null, error: null }), (payload: any) => ({ data: { ...payload, revision: 2 }, error: null }), (payload: any) => ({ data: { ...payload, revision: 3, categories: ['Hymn'] }, error: null })]) {
    await assert.rejects(fixture({ data: null, error: null }, reload).save(), /song changed while you were editing/);
  }
});

test('song update preserves database errors instead of retrying or bypassing permissions', async () => {
  const error = new Error('Permission denied');
  await assert.rejects(fixture({ data: null, error }).save(), /Permission denied/);
});
