import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const songsTab = source('../src/components/SongsTab.tsx');
const appTsx = source('../src/App.tsx');

test('SongsTab positions opened song directly below sticky header instantly without scroll transitions', () => {
  // Verify that smooth scroll into view has been completely removed
  assert.doesNotMatch(
    songsTab,
    /scrollIntoView\(\{\s*behavior:\s*['"]smooth['"]/g,
    'SongsTab should not have smooth scrollIntoView transitions when opening a song'
  );

  // Verify instant positioning below header
  assert.match(
    songsTab,
    /alignSongCardBelowHeader/,
    'SongsTab must define alignSongCardBelowHeader'
  );
  assert.match(
    songsTab,
    /behavior:\s*['"]instant['"]/,
    'SongsTab must scroll instantly without transition animations'
  );
  assert.match(
    songsTab,
    /targetScrollY\s*=\s*Math\.max\(0,\s*Math\.round\(cardTopDoc\s*-\s*headerHeight\s*-\s*8\)\)/,
    'SongsTab must position the top outline of the card directly below the header with padding'
  );
});

test('App.tsx uses instantScroll when opening song detail from setlists or other tabs', () => {
  assert.match(
    appTsx,
    /handleNavigateTab\('songs',\s*\{\s*instantScroll:\s*true\s*\}\)/,
    'handleOpenSongDetail must navigate to songs tab with instantScroll: true'
  );
  assert.match(
    appTsx,
    /options\?:\s*\{\s*instantScroll\?:\s*boolean\s*\}/,
    'handleNavigateTab must accept instantScroll option'
  );
});
