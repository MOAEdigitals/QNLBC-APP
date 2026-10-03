import test from 'node:test';
import assert from 'node:assert/strict';
import { sermonPayload, filterSermons } from '../src/features/sermons/model.ts';
import type { SermonOutline } from '../src/features/sermons/model.ts';

test('sermon persistence preserves literal whitespace, tabs, bullets, asterisks and line endings', () => {
  const outline = '  SERMON  TITLE\r\n\tI. First point\r\n    •  A bullet\n\t\t* Scripture **literal**\n\n  <b>not HTML</b>  \n';
  const saved = sermonPayload({ service_date: '2026-10-04', title: '  Test  ', preacher: ' Preacher ', outline, status: 'published' });
  assert.equal(saved.outline, outline);
  assert.equal(saved.title, 'Test');
  assert.equal(saved.preacher, 'Preacher');
});

test('blank outlines are rejected without mutating the input', () => {
  const input = { service_date: '2026-10-04', title: 'Test', preacher: 'Preacher', outline: ' \t\n ', status: 'draft' as const };
  assert.throws(() => sermonPayload(input));
  assert.equal(input.outline, ' \t\n ');
});

function row(date: string, title = date): SermonOutline {
  return { id: title, service_date: date, title, preacher: 'Marius', outline: '\t• John 3:16', author_id: 'author', status: 'published', revision: 1, created_at: '', updated_at: '' };
}
test('today remains upcoming; future sermons ascend and past sermons descend', () => {
  const rows = [row('2026-10-11'), row('2026-09-20'), row('2026-10-03'), row('2026-09-27')];
  assert.deepEqual(filterSermons(rows, 'upcoming', '2026-10-03', '').map(r => r.service_date), ['2026-10-03', '2026-10-11']);
  assert.deepEqual(filterSermons(rows, 'past', '2026-10-03', '').map(r => r.service_date), ['2026-09-27', '2026-09-20']);
  assert.deepEqual(rows.map(r => r.service_date), ['2026-10-11', '2026-09-20', '2026-10-03', '2026-09-27']);
});
test('search matches title, preacher, and scripture text within the selected filter', () => {
  const rows = [row('2026-10-04', 'Hope'), row('2026-09-20', 'Faith')];
  for (const search of [' hope ', 'MARIUS', 'John 3:16']) assert.equal(filterSermons(rows, 'upcoming', '2026-10-03', search).length, 1);
  assert.equal(filterSermons(rows, 'upcoming', '2026-10-03', 'Faith').length, 0);
});

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
function database() {
  const rows: any[] = [];
  let loseResponse = false;
  let writes = 0;
  const supabase = { from() {
    let operation = 'select'; let payload: any; const filters: Array<(row: any) => boolean> = [];
    const query: any = {
      select() { return query; }, order() { return query; },
      eq(key: string, value: any) { filters.push(row => row[key] === value); return query; },
      insert(value: any) { operation = 'insert'; payload = value; return query; },
      update(value: any) { operation = 'update'; payload = value; return query; },
      async maybeSingle() {
        let found = rows.filter(row => filters.every(filter => filter(row)));
        if (operation === 'insert') {
          if (rows.some(row => row.id === payload.id)) return { data: null, error: { message: 'Duplicate ID' } };
          const row = { ...payload, revision: 1 }; rows.push(row); found = [row]; writes++;
          if (loseResponse) return { data: null, error: { message: 'Response lost' } };
        } else if (operation === 'update') { found.forEach(row => Object.assign(row, payload, { revision: row.revision + 1 })); writes += found.length; }
        return { data: found[0] ? { ...found[0] } : null, error: null };
      }
    }; return query;
  } };
  const exports: any = {};
  const source = readFileSync('src/features/sermons/data.ts', 'utf8');
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, require: (name: string) => name === '../../supabase' ? { supabase, isSupabaseConfigured: () => true } : { sermonPayload }
  });
  return { rows, save: exports.saveSermon, loseResponse: (value: boolean) => { loseResponse = value; }, writes: () => writes };
}
const input = { service_date: '2026-10-04', title: 'Grace', preacher: 'Preacher', outline: '  I. Grace\n\t* John 3:16  \n', status: 'draft' as const };
test('lost insert response can be retried without creating a duplicate sermon', async () => {
  const db = database(); db.loseResponse(true);
  await assert.rejects(() => db.save(input, 'author', undefined, 'stable-id'), /Response lost/);
  db.loseResponse(false);
  const saved = await db.save(input, 'author', undefined, 'stable-id');
  assert.equal(db.rows.length, 1); assert.equal(saved.outline, input.outline); assert.equal(saved.id, 'stable-id');
});
test('stale revision cannot overwrite a newer sermon and input text stays intact', async () => {
  const db = database(); const initial = await db.save(input, 'author', undefined, 'stable-id');
  await db.save({ ...input, outline: 'Newer sermon' }, 'author', initial);
  await assert.rejects(() => db.save(input, 'author', initial), /changed on another device/);
  assert.equal(db.rows[0].outline, 'Newer sermon'); assert.equal(input.outline, '  I. Grace\n\t* John 3:16  \n');
});
test('retry does not update a record belonging to another author', async () => {
  const db = database(); await db.save(input, 'author', undefined, 'stable-id');
  await assert.rejects(() => db.save(input, 'someone-else', undefined, 'stable-id'), /another author/);
  assert.equal(db.writes(), 1);
});
