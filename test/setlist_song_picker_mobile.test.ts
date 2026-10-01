import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src/components/AutofillInput.tsx', 'utf8');

test('mobile setlist song picker browses before enabling the keyboard', () => {
  assert.match(source, /event\.pointerType !== 'touch'/);
  assert.match(source, /First mobile tap browses the library without summoning the keyboard/);
  assert.match(source, /A second tap on the same field explicitly opts into typing/);
  assert.match(source, /readOnly=\{showSongCategoryFilters && isTouchSongPicker && isBrowseOnly\}/);
});

test('mobile song suggestions open upward and stay clear of the sticky save controls', () => {
  assert.match(source, /max-sm:bottom-full/);
  assert.match(source, /max-sm:max-h-\[46dvh\]/);
  assert.match(source, /sticky top-0 z-10 bg-white/);
});
