import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const component = readFileSync('src/components/SetlistsTab.tsx', 'utf8').replace(/\r\n/g, '\n');

test('Setlists uses the shared lower-right plus action and retains the setlist type chooser', () => {
  assert.match(component, /!isEditing && !selectedSetlistId/);
  assert.match(component, /aria-label="New setlist"[\s\S]*?fixed bottom-20[\s\S]*?<Plus className="w-6 h-6 stroke-\[2\.5\]"/);
  assert.match(component, /fixed bottom-36 right-4[\s\S]*?Sunday Service[\s\S]*?Midweek Prayer Meeting[\s\S]*?Fellowship Gathering[\s\S]*?Special Event/);
  assert.doesNotMatch(component, /<span>New setlist<\/span>/);
});
