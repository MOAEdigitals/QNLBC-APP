import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const songsTab = source('../src/components/SongsTab.tsx');

test('SongsTab removes Reference Tracks & Files and Instrumental Tracks text from section headers', () => {
  assert.doesNotMatch(
    songsTab,
    /Reference Tracks & Files/g,
    'SongsTab should not have "Reference Tracks & Files"'
  );
  assert.doesNotMatch(
    songsTab,
    /Instrumental Tracks/g,
    'SongsTab should not have "Instrumental Tracks"'
  );

  assert.match(
    songsTab,
    /Plus One \(\+1\)\s*<\/span>/,
    'SongsTab should cleanly render "Plus One (+1)"'
  );
  assert.match(
    songsTab,
    /Minus One \(-1\)\s*<\/span>/,
    'SongsTab should cleanly render "Minus One (-1)"'
  );
});
