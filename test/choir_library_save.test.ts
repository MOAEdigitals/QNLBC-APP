import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import { songTitleCase } from '../src/utils/songTitleCase.ts';

const source = readFileSync('src/App.tsx', 'utf8').replace(/\r\n/g, '\n');
const code = source.slice(source.indexOf('  const handleSaveChoirEntry ='), source.indexOf('  const handleDeleteChoirEntry ='));
function setup(initial: any[] = []) {
  let songs = [...initial];
  const calls: string[] = [];
  const drafts: any[] = [];
  let failSong = false;
  let failChoir = false;
  let lineup: any;
  const context: any = {
    songs, choirEntries: [], songTitleCase, requirePermission: () => true,
    upsertSongFromSpecialNumber: (title: string, lyrics: string) => ({ id: 'library-id', title, lyrics }),
    supabaseSaveSong: async (draft: any) => { calls.push('song'); if (failSong) throw Error('Song failed'); drafts.push(draft); return { ...draft, id: 'returned-library-id' }; },
    supabaseSaveChoirEntry: async (entry: any) => { calls.push('choir'); if (failChoir) throw Error('Choir failed'); lineup = entry; return entry; },
    setSongs: (update: any) => { songs = update(songs); context.songs = songs; },
    setChoirEntries() {}, fetchChoirEntries: async () => [], preserveOnRefreshFailure: () => [],
    console: { error() {} },
  };
  runInNewContext(ts.transpileModule(code + '\nthis.save = handleSaveChoirEntry;', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return { save: (entry: any) => context.save(entry), calls, drafts, get lineup() { return lineup; }, get songs() { return songs; }, failSong: () => { failSong = true; }, failChoir: (value: boolean) => { failChoir = value; } };
}
const draft = { id: 'lineup-id', songTitle: 'new choir song', lyrics: 'VERSE 1\nOriginal lyrics', date: '2026-11-08' };

test('new choir song is saved once before lineup, linked using returned ID, and title cased', async () => {
  const state = setup();
  assert.equal(await state.save(draft), true);
  assert.deepEqual(state.calls, ['song', 'choir']);
  assert.equal(state.lineup.songId, 'returned-library-id');
  assert.equal(state.lineup.songTitle, 'New Choir Song');
  assert.equal(state.drafts[0].lyrics, draft.lyrics);
  assert.equal(state.drafts[0].category, 'Choir');
});
test('existing library song is linked without overwriting its lyrics or creating a duplicate', async () => {
  const song = { id: 'existing', title: 'New Choir Song', lyrics: 'Library lyrics' };
  const state = setup([song]);
  await state.save({ ...draft, songTitle: ' NEW CHOIR SONG ' });
  assert.deepEqual(state.calls, ['choir']);
  assert.equal(state.lineup.songId, 'existing');
  assert.equal(state.lineup.lyrics, draft.lyrics);
  assert.equal(state.songs[0].lyrics, 'Library lyrics');
});
test('song failure stops lineup save; lineup retry reuses the song already saved', async () => {
  const failed = setup(); failed.failSong();
  assert.equal(await failed.save(draft), false);
  assert.deepEqual(failed.calls, ['song']);
  const retry = setup(); retry.failChoir(true);
  assert.equal(await retry.save(draft), false);
  retry.failChoir(false);
  assert.equal(await retry.save(draft), true);
  assert.deepEqual(retry.calls, ['song', 'choir', 'choir']);
});
test('title-only choir entry also creates a library song', async () => {
  const state = setup();
  assert.equal(await state.save({ ...draft, lyrics: '' }), true);
  assert.deepEqual(state.calls, ['song', 'choir']);
});

test('choir form waits for save, blocks double submit, and retains failed draft', async () => {
  const component = readFileSync('src/components/SpecialNumberTab.tsx', 'utf8').replace(/\r\n/g, '\n');
  const handler = component.slice(component.indexOf('  const handleSaveChoirSubmit ='), component.indexOf('  const handleToggleChoirDone ='));
  let resolve: (value: boolean) => void = () => {};
  let calls = 0; let closed = false; let error = ''; let saving = false;
  const context: any = {
    editingChoir: draft, songs: [], choirSavingRef: { current: false },
    setIsSavingChoir: (value: boolean) => { saving = value; }, setChoirSaveError: (value: string) => { error = value; },
    showChoirArtistInput: false, newChoirArtist: '', generateUUID: () => 'lineup-id', isUUID: () => true,
    getNextSundayStr: () => '2026-11-08', setNewChoirArtist() {}, setShowChoirArtistInput() {},
    setIsEditingChoir: (value: boolean) => { closed = !value; }, setEditingChoir() {},
    onSaveChoirEntry: () => { calls++; return new Promise<boolean>(done => { resolve = done; }); },
  };
  runInNewContext(ts.transpileModule(handler + '\nthis.save = handleSaveChoirSubmit;', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  const pending = context.save({ preventDefault() {} });
  await context.save({ preventDefault() {} });
  assert.equal(calls, 1); assert.equal(saving, true); assert.equal(closed, false);
  resolve(false); await pending;
  assert.equal(closed, false); assert.match(error, /Unable to save/); assert.equal(saving, false);
});
