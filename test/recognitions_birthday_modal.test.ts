import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const recognitions = source('../src/components/RecognitionsTab.tsx');

test('RecognitionsTab removes the Ministry / Group option from Add Birthday Celebrant modal', () => {
  // Ensure the Ministry / Group label and input have been removed
  assert.doesNotMatch(
    recognitions,
    /Ministry \/ Group/i,
    'Ministry / Group field label should be removed from RecognitionsTab'
  );
  assert.doesNotMatch(
    recognitions,
    /bday-ministry-group/,
    'bday-ministry-group input element should be removed'
  );
  assert.doesNotMatch(
    recognitions,
    /bday_ministry_group/,
    'bday_ministry_group name should be removed'
  );
  assert.doesNotMatch(
    recognitions,
    /Enter ministry or group/i,
    'placeholder "Enter ministry or group" should be removed'
  );
});
