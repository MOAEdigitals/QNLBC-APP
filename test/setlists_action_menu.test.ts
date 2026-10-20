import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src/components/SetlistsTab.tsx', 'utf8');

test('setlist action menu closes from taps inside expanded cards and elsewhere', () => {
  assert.match(source, /document\.addEventListener\('pointerdown', handleDocumentPointerDown, true\)/);
  assert.match(source, /target\?\.closest\('\[data-setlist-actions\]'\)/);
  assert.match(source, /data-setlist-actions=\{item\.id\}/);
  assert.match(source, /setOpenMenuSetlistId\(null\)/);
});

test('past setlist actions stay opaque and open above adjacent cards', () => {
  assert.doesNotMatch(source, /opacity-60|grayscale/);
  assert.match(source, /relative p-3 min-w-0/);
  assert.match(source, /openMenuSetlistId === item.id \? 'z-40' : 'z-0'/);
  assert.match(source, /border transition-colors cursor-pointer/);
});
