import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const songs = source('../src/components/SongsTab.tsx');

test('SongsTab removes collapse text and chevron icons from song card footer while preserving Add Attachment', () => {
  // Verify that Collapse label and icons in the song footer were removed
  assert.doesNotMatch(
    songs,
    /<span className="text-\[11px\] font-semibold tracking-wide">Collapse<\/span>/,
    'SongsTab should not have Collapse text in the footer'
  );

  // Verify that the Add Attachment button is still present in the footer
  assert.match(
    songs,
    /id=\{`song-footer-\$\{song\.id\}`\}/,
    'Song footer container must exist'
  );
  assert.match(
    songs,
    /<span>Add Attachment<\/span>/,
    'Add Attachment button must be preserved'
  );
  assert.match(
    songs,
    /handleOpenAddAttachment\('minus_one', e\)/,
    'Add Attachment handler must remain functional'
  );
});
