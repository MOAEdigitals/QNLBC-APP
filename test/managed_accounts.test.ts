import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const auth = readFileSync('src/components/AuthScreen.tsx', 'utf8');
const settings = readFileSync('src/components/SettingsTab.tsx', 'utf8');
const profile = readFileSync('src/services/supabaseData.ts', 'utf8');

test('login is username and password only with no public registration UI', () => {
  assert.doesNotMatch(auth, /Register Account|Create Account|auth\.signUp/);
  assert.doesNotMatch(auth, /Email Address/);
  assert.match(auth, />\s*Username\s*</);
  assert.match(auth, /functions\.invoke\('username-auth'/);
});

test('administrators can create managed username accounts', () => {
  assert.match(settings, /New member/);
  assert.match(settings, /createManagedUser\(newMember\)/);
  assert.match(profile, /functions\.invoke\('admin-create-user'/);
});

test('profile updates reload separately instead of coercing the update response to one row', () => {
  assert.doesNotMatch(profile, /query\.select\(\)\.single\(\)/);
  assert.match(profile, /Profile updated but could not be reloaded/);
});
