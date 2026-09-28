import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const component = readFileSync('src/components/SpecialNumberTab.tsx', 'utf8');

test('special-number tab badges count current and upcoming records instead of archive totals', () => {
  assert.match(component, /const currentScheduleCount = specialNumbers\.filter\([\s\S]*?!isPastDate\(entry\.scheduledDate\)/);
  assert.match(component, /const currentPracticeCount = practiceEntries\.filter\([\s\S]*?if \(entry\.isDone\) return false/);
  assert.match(component, /const date = entry\.practiceDate \|\| entry\.targetDate \|\| ''/);
  assert.match(component, /const currentChoirCount = choirEntries\.filter\([\s\S]*?!entry\.isDone && !isPastDate\(entry\.date\)/);
  assert.match(component, /\{currentScheduleCount\}/);
  assert.match(component, /\{currentPracticeCount\}/);
  assert.match(component, /\{currentChoirCount\}/);
  assert.doesNotMatch(component, /\{specialNumbers\.length\}\s*<\/span>/);
  assert.doesNotMatch(component, /\{practiceEntries\.length\}\s*<\/span>/);
  assert.doesNotMatch(component, /\{choirEntries\.length\}\s*<\/span>/);
});
