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
  assert.match(settings, /createManagedUser\(\{ \.\.\.newMember, username: createdCredentials\.username \}\)/);
  assert.match(profile, /invokeAdminFunction\('admin-create-user'/);
  assert.match(profile, /Authorization: `Bearer \$\{token\}`/);
});

test('new or reset member credentials can be revealed and copied without database password storage', () => {
  assert.match(settings, /showNewMemberPassword/);
  assert.match(settings, /showMemberEditPassword/);
  assert.match(settings, /Copy credentials/);
  assert.match(settings, /This password is shown only in this admin session/);
  assert.match(settings, /Existing passwords cannot be retrieved/);
  assert.match(settings, /navigator\.clipboard\.writeText\(`Username: \$\{username\}\\nPassword: \$\{password\}`\)/);
  assert.doesNotMatch(profile, /password_hash|passwordHash/);
});

test('profile updates reload separately instead of coercing the update response to one row', () => {
  assert.doesNotMatch(profile, /query\.select\(\)\.single\(\)/);
  assert.match(profile, /Profile updated but could not be reloaded/);
});

test('account identity is saved by the Auth transaction without a second profile write', () => {
  const update = readFileSync('supabase/functions/admin-update-user/index.ts', 'utf8');
  const migration = readFileSync('supabase/migrations/20261008_atomic_account_profile.sql', 'utf8');
  assert.match(update, /auth\.admin\.updateUserById/);
  assert.doesNotMatch(update, /from\('profiles'\)\.update/);
  assert.match(migration, /after update of raw_user_meta_data on auth\.users/);
  assert.match(migration, /values\(new\.id, handle,/);
  assert.doesNotMatch(migration, /raw_user_meta_data->>'(?:role|active|can_add|can_edit|can_delete|can_upload)'/);
  assert.match(settings, /memberSaveLock\.current = true/);
  assert.match(settings, /Account created, but member refresh failed/);
  assert.match(settings, /Account saved, but member refresh failed/);
});

test('username underscores are treated literally when signing in', () => {
  const login = readFileSync('supabase/functions/username-auth/index.ts', 'utf8');
  assert.match(login, /handle\.replaceAll\('_', '\\\\_'\)/);
  assert.match(login, /ilike\('username', literalHandle\)/);
});
