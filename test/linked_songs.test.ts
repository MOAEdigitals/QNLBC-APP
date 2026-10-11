import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { songResolver, linkSongEntry, linkSetlist } from '../src/utils/linkedSongs.ts';

const song = { id: 'song-1', title: 'New title', previousTitles: ['Old title'], lyrics: 'Updated verse', updatedAt: '' };

test('saved setlist sections and legacy named songs follow a library rename without mutating stored data', () => {
  const original = { id: 'setlist', date: '2026-10-11', updatedAt: '', welcomeSong: 'Old title', closingSong: 'Old title', themeSong: 'Old title',
    sundaySchool: { songLeader: 'A', songs: [{ id: 'item', songId: song.id, title: 'Old title', lyricsSnapshot: 'Old lyrics' }] },
    worshipService: { songLeader: 'B', songs: [{ id: 'item2', title: 'Old title' }] },
    program: { songLeader: 'C', songs: [{ id: 'item3', song_id: song.id, title: 'Old title' }] } };
  const linked = linkSetlist(original, songResolver([song]));
  assert.equal(linked.welcomeSong, song.title);
  assert.equal(linked.closingSong, song.title);
  assert.equal(linked.themeSong, song.title);
  for (const section of [linked.sundaySchool, linked.worshipService, linked.program]) {
    assert.equal(section!.songs[0].title, song.title);
    assert.equal(section!.songs[0].lyricsSnapshot, song.lyrics);
    assert.equal(section!.songs[0].songId, song.id);
  }
  assert.equal(original.sundaySchool.songs[0].title, 'Old title');
});

test('special number, choir and practice projections retain media and follow subsequent library edits', () => {
  for (const kind of ['special', 'choir', 'practice']) {
    const entry = { kind, songId: song.id, songTitle: 'Old title', lyrics: 'Old', mediaAttachments: [{ id: 'audio' }] };
    const first = linkSongEntry(entry, songResolver([song]));
    assert.equal(first.songTitle, song.title);
    assert.equal(first.lyrics, song.lyrics);
    assert.equal(first.mediaAttachments, entry.mediaAttachments);
    const second = linkSongEntry(entry, songResolver([{ ...song, title: 'Newest', lyrics: 'Newest verse' }]));
    assert.equal(second.songTitle, 'Newest');
    assert.equal(second.lyrics, 'Newest verse');
  }
});

test('explicit IDs win, missing IDs and ambiguous legacy titles never switch to another song', () => {
  const other = { ...song, id: 'song-2', lyrics: 'Other' };
  const resolve = songResolver([song, other]);
  assert.equal(resolve(song.id, song.title), song);
  assert.equal(resolve('deleted-id', song.title), undefined);
  assert.equal(resolve(undefined, 'Old title'), undefined);
  const standalone = { songTitle: 'Unlisted', lyrics: 'Custom verse' };
  assert.equal(linkSongEntry(standalone, resolve), standalone);
});

test('add-category control remains after every category filter', () => {
  const source = readFileSync(new URL('../src/components/SongsTab.tsx', import.meta.url), 'utf8');
  const plus = source.indexOf('aria-label="Add category"');
  assert.ok(plus > source.indexOf('<span>Starred</span>'));
  assert.ok(plus > source.indexOf('<span>Uncategorized</span>'));
  assert.ok(plus > source.indexOf('allCategories.filter'));
});
