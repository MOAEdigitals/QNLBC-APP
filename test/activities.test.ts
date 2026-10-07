import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const source = fs.readFileSync(path.join(root, 'src/features/activities/Activities.tsx'), 'utf8').replace(/\r\n/g, '\n');
const data = fs.readFileSync(path.join(root, 'src/features/activities/data.ts'), 'utf8').replace(/\r\n/g, '\n');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261006_church_activities.sql'), 'utf8').replace(/\r\n/g, '\n');

test('activities show a month calendar with one dot per activity date occurrence', () => {
  assert.match(source, /Array\.from\(\{ length: Math\.min\(count, 3\) \}/);
  assert.match(source, /grid grid-cols-7/);
  assert.match(source, /Previous month/);
  assert.match(source, /Next month/);
  assert.match(source, /onClick=\{\(\) => showActivitiesForDate\(key\)\}/);
  assert.match(source, /activity-card-\$\{first\.id\}/);
  assert.doesNotMatch(source, /onClick=\{\(\) => canAdd && openNew\(key\)\}/);
  assert.match(source, /setSelectedDate\(date\)/);
  assert.match(source, /isSelected \? 'bg-indigo-100/);
});

test('activities use compact month-grouped cards and a minimal editor', () => {
  assert.match(source, /monthList\(items, item => item\.activityDate/);
  assert.match(source, /min-h-\[72px\]/);
  assert.match(source, />Title<input required/);
  assert.match(source, />Date<input required/);
  assert.match(source, />Time <span[^>]*>\(optional\)/);
});

test('activities persist through a permission-protected Supabase table', () => {
  assert.match(data, /from\('church_activities'\)/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /has_permission\('add'\)/);
  assert.match(migration, /has_permission\('edit'\)/);
  assert.match(migration, /has_permission\('delete'\)/);
});
