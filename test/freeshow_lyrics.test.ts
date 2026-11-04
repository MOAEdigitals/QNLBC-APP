import test from 'node:test';
import assert from 'node:assert/strict';
import { formatFreeShowLyrics } from '../src/utils/freeShowLyrics.ts';

test('FreeShow labels use sentence case without changing sung lines, repetition or blank lines', () => {
  const lyrics = '[VERSE 1]\nHe said, “Chorus” (oooh)~\n\n[\u200bCHORUS]\nSame words\n\nCHORUS:\nSame words\n\n\u200b[BRIDGE]:\nDifferent Words—\n\nPre-Chorus 2\nAnother line\n\nENDING\nLast line\n';
  assert.equal(formatFreeShowLyrics('My SONG', lyrics), '[Title]\nMy SONG\n\n[Verse 1]\nHe said, “Chorus” (oooh)~\n\n[Chorus]\nSame words\n\n[Chorus]\nSame words\n\n[Bridge]\nDifferent Words—\n\n[Pre-chorus 2]\nAnother line\n\n[Ending]\nLast line\n');
});

test('a title block is idempotent and a matching sung first line is retained', () => {
  const once = formatFreeShowLyrics('Song', 'VERSE 1\nWords\n\nCHORUS\nWords');
  assert.equal(formatFreeShowLyrics('Song', once), once);
  assert.equal(formatFreeShowLyrics('Song', 'Song\n\nVERSE 1\nWords'), '[Title]\nSong\n\n[Verse 1]\nWords');
  assert.equal(formatFreeShowLyrics('Song', 'Song\nMore sung words'), '[Title]\nSong\n\nSong\nMore sung words');
  assert.equal(formatFreeShowLyrics('Empty song', ''), '[Title]\nEmpty song\n');
});
