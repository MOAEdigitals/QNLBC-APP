import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import { songTitleCase } from '../src/utils/songTitleCase.ts';

const source = readFileSync('src/App.tsx', 'utf8').replace(/\r\n/g, '\n');
const librarySave = source.slice(source.indexOf('  const saveScheduledLibrarySong ='), source.indexOf('  // Special Number Operations'));
for (const kind of ['SpecialNumber', 'PracticeEntry', 'ChoirEntry']) {
  const start = source.indexOf(`  const handleSave${kind} =`);
  const end = source.indexOf(`  const handleDelete${kind} =`, start);
  const code = librarySave + source.slice(start, end);
  function setup(existing: any[] = [], practices: any[] = []) {
    const calls: string[] = []; let savedEntry: any; let failSong = false; let failEntry = false;
    const context: any = {
      songs: existing, specialNumbers: practices, practiceEntries: practices, choirEntries: practices, songTitleCase,
      requirePermission: () => true,
      upsertSongFromSpecialNumber: (title: string, lyrics: string, minusOneLink: string) => ({ id: 'draft', title, lyrics, minusOneLink }),
      supabaseSaveSong: async (song: any) => { calls.push('song'); if (failSong) throw Error('Song failed'); return { ...song, id: 'persisted-song' }; },
      setSongs: (update: any) => { context.songs = update(context.songs); },
      setSpecialNumbers() {}, setPracticeEntries() {}, setChoirEntries() {}, scheduleOfflineSync() {},
      fetchSpecialNumbers: async () => [], fetchPracticeEntries: async () => [], fetchChoirEntries: async () => [], preserveOnRefreshFailure: () => [],
      console: { error() {} }, formatSupabaseError: (error: any) => error.message, showAppMessage() {},
    };
    context.handleSaveSong = async (song: any) => {
      calls.push('shared song');
      const saved = { ...song, id: song.id === 'draft' ? 'persisted-song' : song.id, revision: (song.revision || 0) + 1 };
      context.songs = [...context.songs.filter((existing: any) => existing.id !== saved.id), saved];
      return saved;
    };
    const persist = async (entry: any) => { calls.push('entry'); if (failEntry) throw Error('Entry failed'); savedEntry = entry; return entry; };
    context.supabaseSaveSpecialNumber = persist;
    context.supabaseSaveChoirEntry = persist;
    context.supabaseCreatePracticeEntry = persist;
    context.supabaseUpdatePracticeEntry = async (_: string, entry: any) => persist(entry);
    runInNewContext(ts.transpileModule(code + `\nthis.save = handleSave${kind};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
    return { save: (entry: any, isNew?: boolean, options?: any) => kind === 'PracticeEntry' ? context.save(entry, isNew, options) : context.save(entry, options), calls, get entry() { return savedEntry; }, get songs() { return context.songs; }, failSong: () => { failSong = true; }, failEntry: (value: boolean) => { failEntry = value; } };
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

  {
    const category = kind === 'ChoirEntry' ? 'Choir' : 'Special';
    const shared = { id: 'existing', title: 'New Song', lyrics: 'Library original', revision: 3, category: 'Hymn', categories: ['Hymn'], attachments: [{ id: 'backing' }] };
    test(`${kind} edits the same library song and saves a live link`, async () => {
      const state = setup([shared], [{ id: draft.id }]);
      const updated = { ...draft, songId: shared.id, lyrics: 'Updated verse' };
      await state.save(updated, false, { mode: 'select', lyricsChanged: true, songRevision: 3, onSongSaved() {} });
      assert.deepEqual(state.calls, ['shared song', 'entry']);
      assert.equal(state.entry.songId, shared.id);
      assert.equal(state.entry.lyricsMode, 'live');
      assert.equal(state.entry.lyricsSnapshot, 'Updated verse');
      assert.equal(state.songs[0].lyrics, 'Updated verse');
      assert.equal(state.songs[0].attachments, shared.attachments);
      assert.deepEqual(Array.from(state.songs[0].categories), ['Hymn', category]);
    });

    test(`${kind} selection links to the latest library lyrics without overwriting a newer edit`, async () => {
      const state = setup([shared]);
      const selected = { ...draft, songId: shared.id, lyrics: 'Stale text' };
      await assert.rejects(state.save(selected, true, { mode: 'select', lyricsChanged: true, songRevision: 2 }), /changed while you were editing/);
      await state.save(selected, true, { mode: 'select', lyricsChanged: false });
      assert.deepEqual(state.calls, ['shared song', 'entry']);
      assert.equal(state.entry.lyrics, shared.lyrics);
      assert.deepEqual(Array.from(state.songs[0].categories), ['Hymn', category]);
      assert.equal(state.entry.lyricsMode, 'live');
    });

    test(`${kind} creates the library song first, and an entry retry can select the saved song`, async () => {
      const state = setup();
      let created: any;
      state.failEntry(true);
      await assert.rejects(state.save(draft, true, { mode: 'create', lyricsChanged: true, onSongSaved: (song: any) => { created = song; } }), /Entry failed/);
      state.failEntry(false);
      await state.save({ ...draft, songId: created.id }, true, { mode: 'select', lyricsChanged: false });
      assert.deepEqual(state.calls, ['shared song', 'entry', 'entry']);
      assert.equal(state.entry.songId, created.id);
      assert.equal(state.songs.length, 1);
      assert.deepEqual(Array.from(state.songs[0].categories), [category]);
      await assert.rejects(state.save(draft, true, { mode: 'create' }), /already exists/);
    });
  }
}
