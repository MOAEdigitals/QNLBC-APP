import test from 'node:test';
import assert from 'node:assert/strict';
import { fuzzyMatchString, searchSong } from '../src/utils/songSearch.ts';
import type { Song } from '../src/types.ts';

test('fast search retains title, typo, initials, artist, lyrics and normalized matching', () => {
  assert.equal(fuzzyMatchString('Amazing Grace', 'amzing').matches, true);
  assert.equal(fuzzyMatchString('Goodness Of God', 'gog').score, 75);
  assert.equal(fuzzyMatchString('Dakiláng Katapatan', 'dakilang').score, 95);
  const song = { title: 'Test Hymn', artist: 'Sample Singer', lyrics: 'A precious promise\nForever with the Lord' } as Song;
  assert.equal(searchSong(song, 'sample').matchedField, 'artist');
  assert.equal(searchSong(song, 'precious promise').matchedField, 'lyrics');
  assert.equal(searchSong(song, 'missing '.repeat(500)).matches, false);
});
test('cached lyrics and titles update after editing an existing song object', () => {
  const song = { title: 'Old Name', lyrics: 'An old promise' } as Song;
  assert.equal(searchSong(song, 'promise').matches, true);
  song.lyrics = 'A shining future'; song.title = 'New Name';
  assert.equal(searchSong(song, 'promise').matches, false);
  assert.equal(searchSong(song, 'shining future').matchedField, 'lyrics');
  assert.equal(searchSong(song, 'new name').matchedField, 'title');
});
test('a different query never reuses another query’s cached match or typo distance', () => {
  assert.equal(fuzzyMatchString('Grace', 'grace').matches, true);
  assert.equal(fuzzyMatchString('Grace', 'absolutely unrelated').matches, false);
  assert.equal(fuzzyMatchString('Grace', 'grace').score, 100);
});
