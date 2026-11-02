import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import { songTitleCase } from '../src/utils/songTitleCase.ts';

const source = readFileSync('src/App.tsx', 'utf8').replace(/\r\n/g, '\n');
for (const kind of ['SpecialNumber', 'PracticeEntry']) {
  const start = source.indexOf(`  const handleSave${kind} =`);
  const end = source.indexOf(`  const handleDelete${kind} =`, start);
  const code = source.slice(start, end);
  function setup(existing: any[] = []) {
    const calls: string[] = []; let savedEntry: any; let failSong = false; let failEntry = false;
    const context: any = {
      songs: existing, specialNumbers: [], practiceEntries: [], songTitleCase,
      requirePermission: () => true,
      upsertSongFromSpecialNumber: (title: string, lyrics: string, minusOneLink: string) => ({ id: 'draft', title, lyrics, minusOneLink }),
      supabaseSaveSong: async (song: any) => { calls.push('song'); if (failSong) throw Error('Song failed'); return { ...song, id: 'persisted-song' }; },
      setSongs: (update: any) => { context.songs = update(context.songs); },
      setSpecialNumbers() {}, setPracticeEntries() {},
      fetchSpecialNumbers: async () => [], fetchPracticeEntries: async () => [], preserveOnRefreshFailure: () => [],
      console: { error() {} }, formatSupabaseError: (error: any) => error.message, showAppMessage() {},
    };
    const persist = async (entry: any) => { calls.push('entry'); if (failEntry) throw Error('Entry failed'); savedEntry = entry; return entry; };
    context.supabaseSaveSpecialNumber = persist;
    context.supabaseCreatePracticeEntry = persist;
    context.supabaseUpdatePracticeEntry = async (_: string, entry: any) => persist(entry);
    runInNewContext(ts.transpileModule(code + `\nthis.save = handleSave${kind};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
    return { save: (entry: any) => context.save(entry), calls, get entry() { return savedEntry; }, get songs() { return context.songs; }, failSong: () => { failSong = true; }, failEntry: (value: boolean) => { failEntry = value; } };
  }
  const draft = { id: 'entry', songTitle: 'new song', lyrics: 'Arrangement', performerName: 'Team' };
  test(`${kind}: saves new library song first, links returned ID and title, including title-only entries`, async () => {
    for (const lyrics of ['', 'Arrangement']) {
      const state = setup(); await state.save({ ...draft, lyrics });
      assert.deepEqual(state.calls, ['song', 'entry']);
      assert.equal(state.entry.songId, 'persisted-song'); assert.equal(state.entry.songTitle, 'New Song');
      assert.equal(state.songs[0].lyrics, lyrics);
    }
  });
  test(`${kind}: existing song keeps library lyrics and links without a second song save`, async () => {
    const state = setup([{ id: 'existing', title: 'New Song', lyrics: 'Library original' }]);
    await state.save({ ...draft, songTitle: ' NEW SONG ' });
    assert.deepEqual(state.calls, ['entry']); assert.equal(state.entry.songId, 'existing');
    assert.equal(state.entry.lyrics, 'Arrangement'); assert.equal(state.songs[0].lyrics, 'Library original');
  });
  test(`${kind}: failed song prevents entry save; entry retry reuses library song`, async () => {
    const state = setup(); state.failSong();
    await Promise.resolve(state.save(draft)).catch(() => {});
    assert.deepEqual(state.calls, ['song']);
    const retry = setup(); retry.failEntry(true);
    await Promise.resolve(retry.save(draft)).catch(() => {});
    retry.failEntry(false); await retry.save(draft);
    assert.deepEqual(retry.calls, ['song', 'entry', 'entry']);
  });
}
