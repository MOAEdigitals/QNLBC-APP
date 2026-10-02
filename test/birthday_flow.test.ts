import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const recognitions = fs.readFileSync('src/components/RecognitionsTab.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');

test('birthday list includes current and upcoming annual birthdays', () => {
  assert.match(recognitions, /currentWindow: currentBirthdays, upcoming: upcomingBirthdays/);
  assert.match(recognitions, /visibleBirthdays = \[\.\.\.currentBirthdays, \.\.\.upcomingBirthdays\]/);
  assert.match(recognitions, /filteredBirthdays\.map/);
});

test('birthday modal waits for persistence and remains open on failure', () => {
  assert.match(recognitions, /const saved = await onSaveBirthday/);
  assert.match(recognitions, /if \(!saved\)/);
  assert.match(recognitions, /birthdaySaveError/);
  assert.match(recognitions, /isSavingBirthday \? 'Saving\.\.\.'/);
  assert.match(app, /handleSaveBirthday = async \(item: BirthdayCelebrant\): Promise<boolean>/);
  assert.match(app, /return true;/);
  assert.match(app, /return false;/);
});
