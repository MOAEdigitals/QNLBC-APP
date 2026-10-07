import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const files = [
  'src/components/SetlistsTab.tsx',
  'src/components/RecognitionsTab.tsx',
  'src/components/SongsTab.tsx',
  'src/components/SpecialNumberTab.tsx',
  'src/features/activities/Activities.tsx',
  'src/features/sermons/SermonOutlines.tsx',
];

test('primary add buttons share the same rounded-square lower-right FAB geometry', () => {
  for (const file of files) {
    const source = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    assert.match(source, /fixed bottom-20 sm:bottom-22 right-4 sm:right-6 md:right-8[^"\n]*w-14 h-14 rounded-2xl/, file);
  }
});
