import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const app = source('../src/App.tsx');
const songs = source('../src/components/SongsTab.tsx');
const indexes = source('../supabase/migrations/20260923_performance_indexes.sql');

test('major tabs are lazy-loaded and only the active tab is mounted', () => {
  assert.match(app, /const SetlistsTab = lazy\(/);
  assert.match(app, /const SpecialNumberTab = lazy\(/);
  assert.match(app, /currentTab === 'home' && \(/);
  assert.doesNotMatch(app, /currentTab === 'home' \? 'block' : 'hidden'/);
});

test('initial login loads core data and secondary tabs load on demand', () => {
  assert.match(app, /await loadCoreData\(\)/);
  assert.match(app, /loadTabData\(currentTab\)/);
  assert.match(app, /if \(tab === 'recognitions'\)/);
  assert.match(app, /else if \(tab === 'special-numbers'\)/);
});

test('large song results are progressively rendered and deferred while typing', () => {
  assert.match(songs, /const SONG_PAGE_SIZE = 80/);
  assert.match(songs, /useDeferredValue\(searchQuery\)/);
  assert.match(songs, /visibleSongSearchResults\.map/);
  assert.match(songs, /Show more songs/);
});

test('database migration indexes active parent and date query paths', () => {
  assert.match(indexes, /setlist_items \(setlist_id, position\)/);
  assert.match(indexes, /attachments \(owner_type, owner_id, position\)/);
  assert.match(indexes, /practice_entries \(practice_date desc\)/);
});
