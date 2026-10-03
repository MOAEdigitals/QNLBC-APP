import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src/components/AutofillInput.tsx', 'utf8');

test('all mobile autocomplete fields browse before enabling the keyboard', () => {
  assert.match(source, /event\.pointerType !== 'touch'/);
  assert.match(source, /completed stationary tap browses/);
  assert.match(source, /second completed stationary tap explicitly opts into typing/);
  assert.match(source, /readOnly=\{isTouchPicker && isBrowseOnly\}/);
  assert.doesNotMatch(source, /if \(!showSongCategoryFilters \|\| event\.pointerType !== 'touch'\)/);
});

test('touching an edit field during a scroll does not open its picker', () => {
  assert.match(source, /onPointerMove=/);
  assert.match(source, /touch\.moved/);
  assert.match(source, /if \(!touch \|\| touch\.moved\) return/);
  assert.match(source, /onPointerCancel=/);
  assert.match(source, /ignoreTouchClickRef/);
});

test('mobile picker does not render a duplicate search field', () => {
  assert.doesNotMatch(source, /mobileSearchRef/);
  assert.doesNotMatch(source, /Tap again to search/);
});

test('mobile suggestions use one fixed contained portal panel', () => {
  assert.match(source, /createPortal/);
  assert.match(source, /fixed z-\[200\]/);
  assert.match(source, /top: mobilePickerPosition\.top/);
  assert.match(source, /left: mobilePickerPosition\.left/);
  assert.match(source, /formScroller\.scrollTop \+= desiredHeight - availableBelow/);
  assert.match(source, /qnlbc-autofill-open/);
  assert.match(source, /Choose a song/);
  assert.match(source, /min-h-0 overflow-y-auto divide-y/);
  assert.doesNotMatch(source, /scrollIntoView/);
});
