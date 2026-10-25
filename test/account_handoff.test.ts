import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

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
  const code = handler('handleCopyMemberCredentials', 'handleCopyMemberUsername');
  const copy = runInNewContext(ts.transpileModule(`${code}\nhandleCopyMemberCredentials;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
    navigator: { clipboard: { writeText: async (text: string) => { copied = text; } } },
    setCopiedCredentialId() {}, setTimeout() {}, setMemberEditError() {},
  });
  await copy('member', 'sample_user', 'new-password');
  assert.equal(copied, 'Username: sample_user\nPassword: new-password');
});

