import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file: string) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

test('Activities fields suppress unrelated browser and password-manager suggestions', () => {
  const source = read('src/features/activities/Activities.tsx');
  assert.match(source, /<form onSubmit=\{submit\} autoComplete="off" data-form-type="other"/);
  for (const name of ['activity_title', 'activity_date', 'activity_time']) {
    assert.match(source, new RegExp(`name="${name}"[^>]*autoComplete="off"[^>]*data-form-type="other"[^>]*data-lpignore="true"`));
  }
});

test('Outlines fields suppress unrelated browser and password-manager suggestions', () => {
  const source = read('src/features/sermons/SermonOutlines.tsx');
  for (const name of ['sermon_search', 'sermon_service_date', 'sermon_preacher', 'sermon_title']) {
    assert.match(source, new RegExp(`name="${name}"[^>]*autoComplete="off"[^>]*data-form-type="other"[^>]*data-lpignore="true"`));
  }
  assert.match(source, /autoComplete="off" data-form-type="other" className="flex flex-col flex-1 min-h-0"/);

  const editor = read('src/features/sermons/RichOutlineEditor.tsx');
  assert.match(editor, /autocomplete: 'off'[^}]*'data-form-type': 'other'[^}]*'data-lpignore': 'true'/);
});
