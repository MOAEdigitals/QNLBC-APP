import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function fixture(fail = false) {
  const source = readFileSync('src/utils/storage.ts', 'utf8');
  const section = source.slice(source.indexOf('export function exportChurchDataJSON'), source.indexOf('export function importChurchDataJSON'));
  const exports: any = {};
  let file: Blob;
  let clicks = 0;
  let revoked = false;
  let timeout = 0;
  const anchor: any = { click() { if (fail) throw new Error('Download unavailable'); clicks++; } };
  runInNewContext(ts.transpileModule(section, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Blob, window: {}, console: { warn() {} },
    document: { createElement: () => anchor },
    URL: { createObjectURL(blob: Blob) { file = blob; return 'blob:backup'; }, revokeObjectURL() { revoked = true; } },
    setTimeout(_callback: () => void, delay: number) { timeout = delay; },
  });
  return { download: exports.exportChurchDataJSON, anchor, result: () => ({ file, clicks, revoked, timeout }) };
}

test('download creates a readable JSON file with unchanged lyrics, categories, links and embedded audio', async () => {
  const f = fixture();
  const backup = { tables: { songs: [{ lyrics: 'Verse\n\nChorus', categories: ['Hymn'], link: 'https://example.com/?a=1&b=2' }] }, assets: { recording: 'data:audio/webm;base64,YQ==' } };
  f.download(backup);
  assert.deepEqual(JSON.parse(await f.result().file.text()), backup);
  assert.equal(f.result().file.type, 'application/json');
  assert.equal(f.result().clicks, 1);
  assert.match(f.anchor.download, /^qnlbc_data_backup_\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(f.result().revoked, false, 'Keep the URL alive for mobile download handling');
  assert.ok(f.result().timeout >= 60000);
});

test('download failure propagates to visible UI error handling', () => {
  assert.throws(() => fixture(true).download({ songs: [] }), /Download unavailable/);
});
