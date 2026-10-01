import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const special = readFileSync('src/components/SpecialNumberTab.tsx', 'utf8');
const recognitions = readFileSync('src/components/RecognitionsTab.tsx', 'utf8');
const styles = readFileSync('src/index.css', 'utf8');

test('past schedules remain gray even while expanded', () => {
  assert.match(special, /isPast\s*\? `bg-slate-100\/60[\s\S]*?opacity-60/);
  assert.match(special, /isSelected \? 'ring-2 ring-slate-400 dark:ring-slate-600'/);
});

test('birthday creation no longer exposes or submits ministry/group', () => {
  const birthdayModal = recognitions.slice(
    recognitions.indexOf('{isAddingBirthday && ('),
    recognitions.indexOf('{isAddingAnniversary && (')
  );
  assert.doesNotMatch(birthdayModal, /Ministry \/ Group/);
  assert.doesNotMatch(birthdayModal, /bday-ministry-group/);
  assert.doesNotMatch(recognitions, /ministryOrGroup: bdayForm\.ministryOrGroup/);
});

test('mobile mixer rows retain strict vertical centering', () => {
  assert.match(styles, /\.practice-screen \[id\^="practice-track-"\] > div:nth-of-type\(1\) \{ align-items: center; \}/);
  assert.doesNotMatch(styles, /practice-track-[\s\S]{0,100}align-items: flex-start/);
});
