import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

test('Android text sync replaces deleted rows, retains a failed section, and isolates accounts', async () => {
  const user = { id: 'member', username: 'member', displayName: 'Member' };
  let value = JSON.stringify({ user, songs: [], setlists: [], activities: [], text: {
    birthdays: [{ id: 'old' }], outlines: [{ id: 'cached', outline: 'Previously synced' }],
  } });
  const exports: Record<string, any> = {};
  const empty = async () => [];
  const modules = {
    '@capacitor/core': {
      Capacitor: { getPlatform: () => 'android' },
      registerPlugin: () => ({ read: async () => ({ value }), write: async (input: { value: string }) => { value = input.value; } }),
    },
    './supabaseData': {
      fetchBirthdays: empty, fetchAnniversaries: empty, fetchVisitors: empty, fetchSpecialRecognitions: empty,
      fetchSpecialNumbers: empty, fetchPracticeEntries: empty, fetchChoirEntries: empty,
    },
    '../features/sermons/data': { loadSermons: async () => { throw new Error('Unavailable'); } },
    '../features/notepad/data': { loadNotes: async (userId: string) => [{ user_id: userId, body: 'Personal text' }] },
  };
  const { outputText } = ts.transpileModule(readFileSync('src/services/androidOfflineLibrary.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  runInNewContext(outputText, { exports, require: (name: keyof typeof modules) => modules[name], console: { warn() {} } });
  await exports.writeOfflineLibrary(user, [{ id: 'song', lyrics: 'Song text', attachments: [{ url: 'audio' }] }], [], [], () => true);
  let snapshot = JSON.parse(value);
  assert.deepEqual(snapshot.text.birthdays, []);
  assert.equal(snapshot.text.outlines[0].id, 'cached');
  assert.equal(snapshot.text.notes[0].user_id, user.id);
  assert.equal(snapshot.songs[0].attachments, undefined);

  await exports.writeOfflineLibrary({ ...user, id: 'different' }, [], [], [], () => true);
  snapshot = JSON.parse(value);
  assert.equal(snapshot.text.outlines, undefined);
  assert.equal(snapshot.text.notes[0].user_id, 'different');
});
