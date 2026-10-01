import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src/components/AutofillInput.tsx', 'utf8');

test('all mobile autocomplete fields browse before enabling the keyboard', () => {
  assert.match(source, /event\.pointerType !== 'touch'/);
  assert.match(source, /First mobile tap browses the library without summoning the keyboard/);
  assert.match(source, /A second tap on the same field explicitly opts into typing/);
  assert.match(source, /readOnly=\{isTouchPicker && isBrowseOnly\}/);
  assert.doesNotMatch(source, /if \(!showSongCategoryFilters \|\| event\.pointerType !== 'touch'\)/);
});

test('mobile suggestions use a fixed portal panel clear of form controls', () => {
  assert.match(source, /createPortal/);
  assert.match(source, /fixed z-\[200\] left-3 right-3 bottom-3 max-h-\[58dvh\]/);
  assert.match(source, /scrollIntoView\(\{ block: 'start', behavior: 'smooth' \}\)/);
  assert.match(source, /sticky top-0 z-10 bg-white/);
});
