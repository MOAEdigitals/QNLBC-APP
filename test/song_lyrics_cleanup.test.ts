import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanLeadingSongTitle } from '../src/utils/songLyrics.ts';

test('removes only a matching title directly before verse one, retaining formatting', () => {
  assert.equal(cleanLeadingSongTitle('Dakila', 'DAKILA\r\n\r\n[Verse 1]\r\nLine one\r\n\r\nLine two'), '[Verse 1]\r\nLine one\r\n\r\nLine two');
  assert.equal(cleanLeadingSongTitle('Dakila', '# Dakila\nVerse 1:\nLine'), 'Verse 1:\nLine');
});
test('preserves lyrics, unmatched headings and title lines without a first-verse marker', () => {
  for (const lyrics of ['Dakila\nActual lyric', 'Another title\nVerse 1\nLine', 'Dakila\nAuthor\nVerse 1\nLine', '[Verse 1]\nDakila']) {
    assert.equal(cleanLeadingSongTitle('Dakila', lyrics), lyrics);
  }
});
test('title cleanup is idempotent', () => {
  const result = cleanLeadingSongTitle('Dakila', 'Dakila\nVerse 1\nLine');
  assert.equal(cleanLeadingSongTitle('Dakila', result), result);
});
