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

test('past or done cards in schedules, practice, and choir are grayed out', () => {
  // Schedules subtab checks isElapsed (isPast || isDone) and applies opacity-60 and grayscale
  assert.match(
    component,
    /const isDone = Boolean\(\(item as any\)\.isDone \|\| item\.status === 'completed'\);[\s\S]*?const isElapsed = Boolean\(isPast \|\| isDone\);/
  );
  assert.match(
    component,
    /isElapsed\s*\?\s*'[^']*?opacity-60[^']*?grayscale[^']*?'/
  );

  // Practice subtab checks isElapsed (isDone || isPast) and applies opacity-60 and grayscale
  assert.match(
    component,
    /const practiceDate = group\.practiceDate \|\| group\.targetDate \|\| '';[\s\S]*?const isPast = Boolean\(practiceDate && isPastDate\(practiceDate\) && !isToday\(practiceDate\)\);[\s\S]*?const isElapsed = Boolean\(isDone \|\| isPast\);/
  );

  // Choir subtab checks isElapsed (entry.isDone || isPast) and applies opacity-60 and grayscale
  assert.match(
    component,
    /const isElapsed = Boolean\(entry\.isDone \|\| isPast\);/
  );
});
