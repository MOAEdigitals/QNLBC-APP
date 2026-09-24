import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const songsTab = source('../src/components/SongsTab.tsx');

test('SongsTab moves copy icon out of title bar and places it next to fullscreen prompter icon', () => {
  // Verify that the title bar header only contains track count (if any) and star button, not the copy button
  assert.match(
    songsTab,
    /<div className="flex items-center space-x-2 shrink-0">[\s\S]*?totalTrackCount > 0[\s\S]*?handleToggleStar\(song, e\)[\s\S]*?<\/div>/,
    'Title bar right actions must only contain track badge and star toggle'
  );

  // Verify copy button is positioned in the action bar directly next to Maximize2 (fullscreen stage view)
  assert.match(
    songsTab,
    /<Maximize2 className="w-4 h-4" \/>[\s\S]*?<\/button>[\s\S]*?<button[\s\S]*?handleCopySong\(song, e\)[\s\S]*?<Copy className="w-4 h-4" \/>/,
    'Copy button must be placed next to Maximize2 icon in the expanded action bar'
  );
});
