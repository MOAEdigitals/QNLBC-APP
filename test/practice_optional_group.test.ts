import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

test('an explicitly cleared optional practice group does not restore its old name or invent a default', () => {
  const source = readFileSync('src/services/supabaseData.ts', 'utf8');
  const chunk = source.slice(source.indexOf('function buildPracticePayload('), source.indexOf('async function syncOwnerAttachments('));
  const exports: any = {};
  runInNewContext(ts.transpileModule(chunk + '\nexports.build=buildPracticePayload;', { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, isUUID: () => false });
  assert.equal(exports.build({ songTitle: 'Higher Ground', groupName: '', group_name: 'Old group' }).group_name, '');
  assert.equal(exports.build({ songTitle: 'Higher Ground' }).group_name, '');
  assert.equal(exports.build({ songTitle: 'Higher Ground', groupName: '  Choir  ' }).group_name, 'Choir');
});
