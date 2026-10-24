import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { getUpcomingSongSchedule } from '../src/utils/songSchedule.ts';
import { celebrationConfetti } from '../src/utils/celebrationConfetti.ts';
import { sermonSearchSnippet, sermonSearchRank } from '../src/features/sermons/model.ts';
import type { Setlist, Song } from '../src/types.ts';
import type { SermonOutline } from '../src/features/sermons/model.ts';

function preferences(file: string, values: Map<string, string>) {
  const exports: any = {};
  runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } });
  return exports;
}

test('this update resets existing light preferences once, then preserves a new light choice across launches', () => {
  const values = new Map([['nlbc_theme_v1', 'light'], ['sb-auth-token', 'keep me']]);
  let store = preferences('src/utils/storage.ts', values);
  assert.equal(store.loadTheme(), 'dark');
  store.saveTheme('light');
  store = preferences('src/utils/storage.ts', values);
  assert.equal(store.loadTheme(), 'light');
  assert.equal(values.get('sb-auth-token'), 'keep me');
  assert.equal(preferences('src/utils/storage.ts', new Map()).loadTheme(), 'dark');
});

test('Plus Jakarta Sans is the default and a valid personal font choice remains available', () => {
  const values = new Map<string, string>();
  assert.equal(preferences('src/utils/appFont.ts', values).loadAppFont(), 'Plus Jakarta Sans');
  values.set('qnlbc_app_font', 'Manrope');
  assert.equal(preferences('src/utils/appFont.ts', values).loadAppFont(), 'Manrope');
});

const song = { id: 'song1', title: 'Amazing Grace' } as Song;
function setlist(date: string, section = 'sundaySchool'): Setlist {
  return { id: date, date, [section]: { songs: [{ songId: song.id, title: song.title }] } } as unknown as Setlist;
}
test('schedule status follows today/future songs in every service section and updates after removal', () => {
  const today = '2026-10-24';
  for (const section of ['sundaySchool', 'worshipService', 'program']) {
    const current = setlist(today, section), later = setlist('2026-10-25', section), past = setlist('2026-10-18', section);
    const records = [later, past, current];
    assert.equal(getUpcomingSongSchedule(song, records, today), current);
    assert.equal(records[0], later, 'search does not mutate shared ordering');
    (current as any)[section].songs = [];
    assert.equal(getUpcomingSongSchedule(song, records, today), later);
    (later as any)[section].songs = [];
    assert.equal(getUpcomingSongSchedule(song, records, today), undefined);
  }
});
test('named songs use current values rather than stale legacy aliases and match old title-only rows', () => {
  const current = { id: '1', date: '2026-10-25', welcomeSong: '', welcome_song: song.title } as Setlist;
  assert.equal(getUpcomingSongSchedule(song, [current], '2026-10-24'), undefined);
  current.themeSong = '  AMAZING GRACE ';
  assert.equal(getUpcomingSongSchedule(song, [current], '2026-10-24'), current);
  const legacy = setlist('2026-10-25');
  legacy.sundaySchool!.songs = [{ title: ' Amazing Grace ' } as any];
  assert.equal(getUpcomingSongSchedule(song, [legacy], '2026-10-24'), legacy);
  legacy.sundaySchool!.songs[0].songId = 'other-song';
  assert.equal(getUpcomingSongSchedule(song, [legacy], '2026-10-24'), undefined);
});

test('confetti has a limited irregular scatter that stays stable per card and varies between cards', () => {
  const first = celebrationConfetti('birthday-one');
  assert.deepEqual(celebrationConfetti('birthday-one'), first);
  assert.notDeepEqual(celebrationConfetti('birthday-two'), first);
  const background = (first as any)['--celebration-confetti'];
  assert.equal(background.match(/no-repeat/g).length, 14);
  assert.doesNotMatch(background, /repeat-x|repeat-y/);
});

test('outline search snippets show the matching body text with readable context, including rich-only records', () => {
  const row = { title: 'Grace', preacher: 'Marius', outline: 'An introduction.\nGod gives\tus hope through faith. A conclusion.' } as SermonOutline;
  const snippet = sermonSearchSnippet(row, ' GIVES us ');
  assert.ok(snippet);
  assert.equal(snippet.match, 'gives us');
  assert.match(snippet.before, /God /);
  assert.match(snippet.after, /hope through faith/);
  assert.equal(sermonSearchSnippet(row, ''), null);
  assert.equal(sermonSearchSnippet(row, 'missing'), null);
  row.outline = ' ';
  row.outline_html = '<p>Faith &amp; hope remain.</p>';
  assert.equal(sermonSearchRank(row, 'hope'), 1);
  assert.equal(sermonSearchSnippet(row, 'hope')?.match, 'hope');
  row.outline = 'word '.repeat(100) + 'baptism gives new life ' + 'end '.repeat(100);
  const long = sermonSearchSnippet(row, 'baptism')!;
  assert.ok(long.before.startsWith('…') && long.after.endsWith('…'));
  assert.ok((long.before + long.match + long.after).length < 180);
});
