import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanLeadingSongTitle, cleanEmptyChorusLabels } from '../src/utils/songLyrics.ts';

test('removes empty chorus repeats before a bridge and at the end', () => {
  const lyrics = 'Verse 1\nFirst verse\n\nChorus\nActual chorus\n\nVerse 2\nSecond verse\n\nChorus\n\nBridge\nBridge lyrics\n\nChorus';
  const expected = 'Verse 1\nFirst verse\n\nChorus\nActual chorus\n\nVerse 2\nSecond verse\n\nBridge\nBridge lyrics';
  assert.equal(cleanEmptyChorusLabels(lyrics), expected);
  assert.equal(cleanEmptyChorusLabels(expected), expected);
});

test('preserves chorus lyrics and inline mentions, handles CRLF and consecutive empty headings', () => {
  const lyrics = '[Chorus]:\r\n\r\nSing the chorus\r\n\r\nCHORUS\r\n\r\nChorus 2:\r\n\r\n[Verse 2]\r\nNext verse';
  assert.equal(cleanEmptyChorusLabels(lyrics), '[Chorus]:\r\n\r\nSing the chorus\r\n\r\n[Verse 2]\r\nNext verse');
  assert.equal(cleanEmptyChorusLabels('Chorus\n\nActual lyrics\n'), 'Chorus\n\nActual lyrics\n');
});

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
