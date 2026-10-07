import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const component = readFileSync('src/components/SpecialNumberTab.tsx', 'utf8');

test('schedule subtabs do not render numeric count bubbles', () => {
  assert.doesNotMatch(component, /currentScheduleCount/);
  assert.doesNotMatch(component, /currentPracticeCount/);
  assert.doesNotMatch(component, /currentChoirCount/);
  assert.doesNotMatch(component, /absolute top-0 right-0 sm:static/);
});
