import test from 'node:test';
import assert from 'node:assert/strict';
import { formatAccountCredentials } from '../src/utils/accountCredentials.ts';

test('account delivery includes the webapp link, name, username and newly set password', () => {
  assert.equal(formatAccountCredentials('Test Member', 'test.member', 'Test-only-password!'), 'Webapp: https://moaedigitals.github.io/QNLBC-APP/\nName: Test Member\nUsername: test.member\nPassword: Test-only-password!');
  assert.throws(() => formatAccountCredentials('Test Member', 'test.member', ''), /Set a password/, 'never copy incomplete credentials');
});
