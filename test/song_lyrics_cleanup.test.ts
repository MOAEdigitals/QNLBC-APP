import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanLeadingSongTitle, cleanEmptySectionLabels, cleanDuplicateChorusSections } from '../src/utils/songLyrics.ts';

test('removes empty chorus repeats before a bridge and at the end', () => {
  const lyrics = 'Verse 1\nFirst verse\n\nChorus\nActual chorus\n\nVerse 2\nSecond verse\n\nChorus\n\nBridge\nBridge lyrics\n\nChorus';
  const expected = 'Verse 1\nFirst verse\n\nChorus\nActual chorus\n\nVerse 2\nSecond verse\n\nBridge\nBridge lyrics';
  assert.equal(cleanEmptySectionLabels(lyrics), expected);
  assert.equal(cleanEmptySectionLabels(expected), expected);
});

test('preserves chorus lyrics and inline mentions, handles CRLF and consecutive empty headings', () => {
  const lyrics = '[Chorus]:\r\n\r\nSing the chorus\r\n\r\nCHORUS\r\n\r\nChorus 2:\r\n\r\n[Verse 2]\r\nNext verse';
  assert.equal(cleanEmptySectionLabels(lyrics), '[Chorus]:\r\n\r\nSing the chorus\r\n\r\n[Verse 2]\r\nNext verse');
  assert.equal(cleanEmptySectionLabels('Chorus\n\nActual lyrics\n'), 'Chorus\n\nActual lyrics\n');
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

test('removes the consecutive empty verse tags shown in Above All, preserving its actual verse and chorus', () => {
  const lyrics = 'VERSE 1\nAbove all powers,\n\nAbove all kingdoms,\n\nVERSE 1\n\nVERSE 1\n\nCHORUS\nCrucified, Laid behind the stone,\n\nENDING\nAbove all';
  const expected = 'VERSE 1\nAbove all powers,\n\nAbove all kingdoms,\n\nCHORUS\nCrucified, Laid behind the stone,\n\nENDING\nAbove all';
  assert.equal(cleanEmptySectionLabels(lyrics), expected);
  assert.equal(cleanEmptySectionLabels(expected), expected);
});

test('removes empty verse, bridge and ending labels, keeping real lyrics and unlabeled songs intact', () => {
  assert.equal(cleanEmptySectionLabels('VERSE 1\n\nVERSE 2\nActual lyric\n\nBRIDGE\n\nENDING'), 'VERSE 2\nActual lyric');
  const plain = 'Above all powers,\n\nAbove all kings,\n';
  assert.equal(cleanEmptySectionLabels(plain), plain);
  assert.equal(cleanEmptySectionLabels('VERSE 1\n\n'), '');
});

test('keeps only one copy of identical choruses while preserving verses, bridge and ending', () => {
  const lyrics = 'VERSE 1\nFirst verse\n\nCHORUS\nPraise the Lord!\n\nVERSE 2\nSecond verse\n\nCHORUS 2\nPRAISE THE LORD.\n\nBRIDGE\nBridge lyrics\n\nCHORUS 3\nPraise the Lord!\n\nENDING\nEnding lyrics';
  const expected = 'VERSE 1\nFirst verse\n\nCHORUS\nPraise the Lord!\n\nVERSE 2\nSecond verse\n\nBRIDGE\nBridge lyrics\n\nENDING\nEnding lyrics';
  assert.equal(cleanDuplicateChorusSections(lyrics), expected);
  assert.equal(cleanDuplicateChorusSections(expected), expected);
});

test('preserves different chorus lyrics, medley sections and repeat instructions, numbering distinct choruses in order', () => {
  const lyrics = 'VERSE 1\r\nVerse words\r\n\r\nCHORUS 3\r\nFirst chorus\r\n\r\nPre-Chorus r\r\nPrechorus words\r\n\r\nCHORUS 4\r\nDifferent chorus\r\n\r\nBRIDGE\r\n(Repeat Chorus)\r\n\r\nCHORUS 5\r\nFirst chorus';
  assert.equal(cleanDuplicateChorusSections(lyrics), 'VERSE 1\r\nVerse words\r\n\r\nCHORUS\r\nFirst chorus\r\n\r\nPre-Chorus r\r\nPrechorus words\r\n\r\nCHORUS 2\r\nDifferent chorus\r\n\r\nBRIDGE\r\n(Repeat Chorus)');
  for (const plain of ['Lyrics without labels\nRepeated words\nRepeated words', "CHORUS\nWe'll sing\n\nCHORUS 2\nWell sing"]) {
    assert.equal(cleanDuplicateChorusSections(plain), plain);
  }
});

test('treats typographic apostrophes as equivalent without confusing contractions with different words', () => {
  assert.equal(cleanDuplicateChorusSections("CHORUS\nWe'll hold up the light\n\nVERSE 2\nVerse words\n\nCHORUS 2\nWe′ll hold up the light"), "CHORUS\nWe'll hold up the light\n\nVERSE 2\nVerse words");
});
