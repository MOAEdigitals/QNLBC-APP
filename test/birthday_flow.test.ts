import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const recognitions = fs.readFileSync('src/components/RecognitionsTab.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');

test('birthday list includes current and upcoming annual birthdays', () => {
  assert.match(recognitions, /currentWindow: currentBirthdays, upcoming: upcomingBirthdays/);
  assert.match(recognitions, /visibleBirthdays = \[\.\.\.currentBirthdays, \.\.\.upcomingBirthdays\]/);
  assert.match(recognitions, /for \(const item of filteredBirthdays\)/);
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

import { runInNewContext } from 'node:vm';
import ts from 'typescript';
test('birthday edit saves the existing ID, revision and metadata instead of inserting a new birthday', async () => {
  const start = recognitions.indexOf('  const handleAddBirthday =');
  const end = recognitions.indexOf('  const handleAddAnniversary =', start);
  const existing = { id: 'birthday-id', revision: 7, name: 'Old name', birthDate: '1990-10-15', ministryOrGroup: 'Choir', notes: 'Keep notes' };
  let saved: any;
  const context: any = {
    editingBirthday: existing,
    bdayForm: { name: ' New name ', birthDate: '1990-10-16', notes: 'Keep notes' },
    isSavingBirthday: false,
    onSaveBirthday: async (item: any) => { saved = item; return true; },
    generateUUID: () => { throw new Error('Editing must not create a new ID'); },
    getTodayStr: () => '2026-10-03',
    setIsSavingBirthday() {}, setBirthdaySaveError() {}, setEditingBirthday() {}, setBdayForm() {}, setIsAddingBirthday() {},
  };
  runInNewContext(ts.transpileModule(recognitions.slice(start, end) + '\nglobalThis.submit = handleAddBirthday;', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  await context.submit({ preventDefault() {} });
  assert.equal(saved.id, existing.id);
  assert.equal(saved.revision, existing.revision);
  assert.equal(saved.ministryOrGroup, 'Choir');
  assert.equal(saved.name, 'New name');
  assert.equal(saved.birthDate, '1990-10-16');
});
