import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { formatAccountCredentials } from '../src/utils/accountCredentials.ts';

const source = readFileSync('src/components/SettingsTab.tsx', 'utf8');
const handler = (name: string, next: string) => source.slice(source.indexOf(`  const ${name} =`), source.indexOf(`  const ${next} =`));

test('only confirmed password updates are exposed for account handoff', async () => {
  for (const fail of [false, true]) {
    let credentials: any = {};
    let notice: any = null;
    let error = '';
    let draft: any;
    const user = { id: 'member', username: 'oldname' };
    const code = handler('handleUpdateMember', 'handleCopyMemberCredentials');
    const save = runInNewContext(ts.transpileModule(`${code}\nhandleUpdateMember;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
      memberSaveLock: { current: false }, memberEdit: { displayName: 'Name', directoryMemberId: 'directory-person-id', username: ' NewName ', password: 'new-password' }, users: [user],
      copyAfterSaveId: null,
      updateManagedUser: async () => { if (fail) throw new Error('Save failed'); },
      refreshDirectory: async () => {},
      fetchAllProfiles: async () => [], onUpdateUsers() {}, setMemberNotice() {}, setManagingUserId() {}, setEditingMemberId() {},
      setMemberEdit: (value: any) => { draft = value; },
      setMemberEditError: (value: string) => { error = value; },
      setMemberCredentials: (update: any) => { credentials = update(credentials); },
      setCredentialNotice: (value: any) => { notice = typeof value === 'function' ? value(notice) : value; },
    });
    await save({ preventDefault() {} }, user);
    if (fail) {
      assert.equal(notice, null);
      assert.deepEqual(credentials, {});
      assert.equal(error, 'Save failed');
    } else {
      assert.equal(credentials.member.username, 'newname');
      assert.equal(credentials.member.password, 'new-password');
      assert.equal(notice.password, 'new-password');
      assert.equal(draft.password, '', 'clear the edit draft after saving');
    }
  }
});

test('copy credentials uses exact username and password without sending a message', async () => {
  let copied = '';
  const code = handler('handleCopyMemberCredentials', 'handleCopyAccountDetails');
  const copy = runInNewContext(ts.transpileModule(`${code}\nhandleCopyMemberCredentials;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
    navigator: { clipboard: { writeText: async (text: string) => { copied = text; } } },
    users: [{ id: 'member', displayName: 'Sample Member' }], formatAccountCredentials,
    setCopiedCredentialId() {}, setTimeout() {}, setMemberNotice() {},
  });
  await copy('member', 'sample_user', 'new-password');
  assert.equal(copied, 'Webapp: https://moaedigitals.github.io/QNLBC-APP/\nName: Sample Member\nUsername: sample_user\nPassword: new-password');
});

test('missing session password opens an explicit reset form without copying partial credentials', async () => {
  let editing = ''; let pending = ''; let copied = false;
  const code = handler('handleCopyAccountDetails', 'handleDeleteMember');
  const copy = runInNewContext(ts.transpileModule(`${code}\nhandleCopyAccountDetails;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
    memberCredentials: {}, startEditingMember: (user: any) => { editing = user.id; },
    setCopyAfterSaveId: (id: string) => { pending = id; }, setMemberNotice() {},
    handleCopyMemberCredentials: async () => { copied = true; },
  });
  await copy({ id: 'member', username: 'sample_user' });
  assert.equal(editing, 'member'); assert.equal(pending, 'member'); assert.equal(copied, false);
});

