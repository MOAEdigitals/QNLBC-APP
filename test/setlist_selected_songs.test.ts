import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync('src/components/SetlistsTab.tsx', 'utf8');
const memo = source.slice(source.indexOf('  const selectedSetlistSongTitles ='), source.indexOf('  const [showCustomTitle'));
const selected = (editingSetlist: any): string[] => {
  const context: any = { editingSetlist, useMemo: (callback: () => string[]) => callback() };
  runInNewContext(ts.transpileModule(`${memo}\nglobalThis.result = selectedSetlistSongTitles;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return Array.from(context.result);
};

test('Sunday draft song markers include both programs and welcome, closing and theme songs', () => {
  const draft = { type: 'sunday', welcomeSong: 'Welcome', closingSong: 'Closing', themeSong: 'Theme', sundaySchool: { songs: [{ title: 'Amazing Grace' }] }, worshipService: { songs: [{ title: 'Blessed Assurance' }, { title: '' }] }, program: { songs: [{ title: 'Unused legacy program' }] } };
  assert.deepEqual(selected(draft), ['Welcome', 'Closing', 'Theme', 'Amazing Grace', 'Blessed Assurance']);
  draft.sundaySchool.songs = [];
  assert.ok(!selected(draft).includes('Amazing Grace'), 'removal is reflected before saving');
  draft.worshipService.songs.push({ title: 'Amazing Grace' });
  assert.ok(selected(draft).includes('Amazing Grace'), 'a remaining use in any section keeps the check');
});

test('other program types use their own draft songs and respect empty or hidden special-song fields', () => {
  for (const type of ['prayer_meeting', 'fellowship', 'event']) {
    assert.deepEqual(selected({ type, welcomeSong: '', closingSong: '', program: { songs: [{ title: 'Program Song' }] }, sundaySchool: { songs: [{ title: 'Unused Sunday song' }] } }), ['Program Song']);
  }
  assert.deepEqual(selected(null), []);
  assert.deepEqual(selected({ type: 'sunday' }), ['Napakaligaya', 'Give Thanks']);
});
