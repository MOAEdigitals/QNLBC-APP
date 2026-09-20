import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { it } from 'node:test';
import ts from 'typescript';

// Execute the actual production handlers with controlled UI/network boundaries.
// No browser, Supabase credentials, or production records are used.
const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const component = source('../src/components/SpecialNumberTab.tsx');
const app = source('../src/App.tsx');
const service = source('../src/services/supabaseData.ts');
const compile = (code: string) => ts.transpileModule(code, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const handler = (text: string, name: string, next: string) => {
  const start = text.indexOf(`  const ${name} =`);
  const end = text.indexOf(`  const ${next} =`, start);
  assert.ok(start >= 0 && end > start, `Could not locate ${name}`);
  return text.slice(start, end);
};
const practiceId = '11111111-1111-4111-8111-111111111111';
const partId = '22222222-2222-4222-8222-222222222222';
const quietConsole = { error() {}, warn() {} };

function database() {
  const rows: Record<string, any[]> = { practice_entries: [{ id: practiceId }], vocal_parts: [], attachments: [] };
  const counts = { inserts: 0, updates: 0 };
  let failAttachments = false;
  let failInsert = false;
  let loseInsertResponse = false;
  const supabase = {
    from(table: string) {
      let action = 'select';
      let payload: any;
      const filters: Array<(row: any) => boolean> = [];
      const execute = () => {
        if (table === 'attachments' && failAttachments) return { data: null, error: new Error('Attachment sync failed') };
        let found = rows[table].filter(row => filters.every(filter => filter(row)));
        if (action === 'insert') {
          if (table === 'vocal_parts' && failInsert) return { data: null, error: new Error('Persistence unavailable') };
          const row = { ...payload, id: payload.id || `attachment-${rows[table].length}`, revision: 1, created_at: '2026-09-18' };
          if (rows[table].some(item => item.id === row.id)) return { data: null, error: new Error('Duplicate primary key') };
          rows[table].push(row);
          found = [row];
          if (table === 'vocal_parts') {
            counts.inserts++;
            if (loseInsertResponse) return { data: null, error: new Error('Insert response lost') };
          }
        } else if (action === 'update') {
          found.forEach(row => Object.assign(row, payload, { revision: row.revision + 1 }));
          if (table === 'vocal_parts') counts.updates++;
        }
        return { data: found, error: null };
      };
      const query: any = {
        select() { return query; },
        eq(key: string, value: unknown) { filters.push(row => row[key] === value); return query; },
        is(key: string, value: unknown) { filters.push(row => (row[key] ?? null) === value); return query; },
        order() { return query; },
        limit() { return query; },
        insert(value: unknown) { action = 'insert'; payload = value; return query; },
        update(value: unknown) { action = 'update'; payload = value; return query; },
        async maybeSingle() { const result = execute(); return { ...result, data: result.data?.[0] ?? null }; },
        async single() { return query.maybeSingle(); },
        then(resolve: any, reject: any) { return Promise.resolve(execute()).then(resolve, reject); },
      };
      return query;
    },
  };
  const exports: any = {};
  runInNewContext(compile(service.replaceAll('import.meta.env', '({})')), {
    exports, console: quietConsole,
    require: (name: string) => {
      assert.equal(name, '../supabase');
      return { supabase, isSupabaseConfigured: () => true };
    },
  });
  return {
    rows, counts, save: exports.savePracticeVocalPart,
    failAttachments: (value: boolean) => { failAttachments = value; },
    failInsert: (value: boolean) => { failInsert = value; },
    loseInsertResponse: (value: boolean) => { loseInsertResponse = value; },
  };
}

function modal(persist: (...args: any[]) => Promise<any>, refresh = async () => { throw new Error('Refresh unavailable'); }) {
  const group = { id: practiceId, vocalParts: [], parts: [] };
  let entries: any[] = [group];
  const warnings: any[] = [];
  const context: any = {
    console: { ...quietConsole, warn: (...args: any[]) => warnings.push(args) },
    requirePermission: () => true,
    supabaseSavePracticeVocalPart: persist,
    fetchPracticeEntries: refresh,
    setPracticeEntries: (update: any) => { entries = typeof update === 'function' ? update(entries) : update; },
    practiceEntries: entries,
    vocalPartModalGroup: group,
    savingVocalPartRef: { current: false },
    vocalPartSubmissionIdRef: { current: null },
    vocalPartAudioUrl: 'https://audio.example/recording.webm',
    vocalPartFileName: 'Recording',
    vocalPartLabel: 'Soprano', vocalPartCustomLabel: '', vocalPartAssignedUsers: 'Singer',
    editingVocalPartIndex: null, isRecording: false, isAddingVocalPartModal: true,
    cancelRecording: () => { context.cleaned = true; },
    URL: { revokeObjectURL: () => { context.revoked = true; } },
    generateUUID: () => partId,
    isUUID: (id: string) => /^[0-9a-f-]{36}$/.test(id || ''),
    VOCAL_PART_OPTIONS: ['Soprano', 'Alto'],
    saveAudioToStorage: async () => {},
    onSavePracticeEntry: undefined,
  };
  for (const state of ['IsSavingVocalPart', 'VocalPartSaveError', 'VocalPartSaveNotice', 'VocalPartLabel',
    'VocalPartCustomLabel', 'VocalPartAssignedUsers', 'VocalPartAudioUrl', 'VocalPartFileName',
    'VocalPartAudioInputMode', 'IsAddingVocalPartModal', 'VocalPartModalGroup', 'EditingVocalPartIndex',
    'RecordingError', 'IsRecording', 'RecordingSeconds']) {
    context[`set${state}`] = (value: unknown) => { context[state[0].toLowerCase() + state.slice(1)] = value; };
  }
  const code = handler(app, 'handleSavePracticeVocalPart', 'handleDeletePracticeVocalPart')
    + '\nconst onSavePracticeVocalPart = handleSavePracticeVocalPart;\n'
    + handler(component, 'handleCloseVocalPartModal', 'formatRecordTimer')
    + handler(component, 'handleOpenAddVocalPartModal', 'handleSaveVocalPartModalSubmit')
    + handler(component, 'handleSaveVocalPartModalSubmit', 'handleDeleteVocalPart')
    + '\nglobalThis.submit = handleSaveVocalPartModalSubmit; globalThis.close = handleCloseVocalPartModal; globalThis.open = handleOpenAddVocalPartModal;';
  runInNewContext(compile(code), context);
  context.open(group);
  context.vocalPartAudioUrl = 'https://audio.example/recording.webm';
  context.vocalPartFileName = 'Recording';
  return { context, entries: () => entries, warnings, tap: () => context.submit({ preventDefault() {} }) };
}

it('one successful tap persists once, updates local state, closes, resets and reports success despite refresh failure', async () => {
  const db = database();
  const ui = modal(db.save);
  await ui.tap();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(db.counts.inserts, 1);
  assert.equal(ui.context.isAddingVocalPartModal, false);
  assert.equal(ui.context.cleaned, true);
  assert.equal(ui.context.vocalPartAudioUrl, '');
  assert.equal(ui.context.vocalPartSaveNotice, 'Vocal part saved.');
  assert.equal(ui.entries()[0].vocalParts[0].id, partId);
  assert.equal(ui.entries()[0].vocalParts[0].revision, 1);
  assert.equal(ui.warnings.length, 1);
  // Simulate an old event handler still seeing the previous render's group.
  ui.context.vocalPartModalGroup = { id: practiceId };
  await ui.tap(); // A queued submit after close cannot persist again.
  assert.equal(db.counts.inserts, 1);
});

it('rapid taps and close attempts while pending cannot start another persistence request', async () => {
  const db = database();
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let calls = 0;
  const ui = modal(async (...args) => { calls++; await pending; return db.save(...args); });
  const first = ui.tap();
  await ui.tap();
  ui.context.close();
  assert.equal(ui.context.isAddingVocalPartModal, true);
  assert.equal(ui.context.isSavingVocalPart, true);
  release();
  await first;
  assert.equal(calls, 1);
  assert.equal(db.counts.inserts, 1);
  assert.equal(ui.context.isAddingVocalPartModal, false);
  assert.equal(ui.context.isSavingVocalPart, false);
});

it('genuine persistence failure preserves the modal and recording, shows feedback and permits retry', async () => {
  const db = database();
  db.failInsert(true);
  const ui = modal(db.save);
  await ui.tap();
  assert.equal(ui.context.isAddingVocalPartModal, true);
  assert.match(ui.context.vocalPartSaveError, /Persistence unavailable/);
  assert.equal(ui.context.vocalPartAudioUrl, 'https://audio.example/recording.webm');
  assert.equal(ui.context.vocalPartFileName, 'Recording');
  assert.equal(ui.context.savingVocalPartRef.current, false);
  assert.equal(ui.context.isSavingVocalPart, false);
  assert.equal(ui.context.vocalPartSubmissionIdRef.current, partId);
  assert.equal(db.counts.inserts, 0);
  db.failInsert(false);
  await ui.tap();
  assert.equal(db.counts.inserts, 1);
  assert.equal(ui.context.isAddingVocalPartModal, false);
});

it('the synchronous lock also covers stopping a recording before persistence starts', async () => {
  const db = database();
  const ui = modal(db.save);
  let release!: (audio: string) => void;
  let stops = 0;
  ui.context.isRecording = true;
  ui.context.stopRecording = () => {
    stops++;
    return new Promise<string>(resolve => { release = resolve; });
  };
  const first = ui.tap();
  await ui.tap();
  ui.context.close();
  assert.equal(stops, 1);
  assert.equal(db.counts.inserts, 0);
  assert.equal(ui.context.isAddingVocalPartModal, true);
  release('https://audio.example/recording.webm');
  await first;
  assert.equal(db.counts.inserts, 1);
  assert.equal(ui.context.isAddingVocalPartModal, false);
});

it('retry after a saved row and failed attachment sync reuses its UUID and updates instead of inserting', async () => {
  const db = database();
  db.failAttachments(true);
  const ui = modal(db.save);
  await ui.tap();
  assert.equal(db.counts.inserts, 1);
  assert.equal(ui.context.isAddingVocalPartModal, true);
  assert.match(ui.context.vocalPartSaveError, /Attachment sync failed/);
  db.failAttachments(false);
  await ui.tap();
  assert.equal(db.counts.inserts, 1);
  assert.equal(db.counts.updates, 1);
  assert.equal(db.rows.vocal_parts.length, 1);
  assert.equal(db.rows.attachments.length, 1);
  assert.equal(db.rows.attachments[0].owner_id, partId);
  assert.equal(ui.context.isAddingVocalPartModal, false);
});

it('retry after a lost insert response reuses the row; another modal may add the same voice label', async () => {
  const db = database();
  db.loseInsertResponse(true);
  const ui = modal(db.save);
  await ui.tap();
  assert.equal(db.counts.inserts, 1);
  assert.equal(ui.context.isAddingVocalPartModal, true);
  db.loseInsertResponse(false);
  await ui.tap();
  assert.equal(db.counts.inserts, 1);
  await db.save(practiceId, { id: '33333333-3333-4333-8333-333333333333', partLabel: 'Soprano' }, 1);
  assert.equal(db.rows.vocal_parts.length, 2);
});

it('editing reuses the existing UUID and attachment metadata', async () => {
  const db = database();
  const part = await db.save(practiceId, { id: partId, partLabel: 'Soprano', audioUrl: 'https://audio.example/old' }, 0);
  const ui = modal(db.save);
  ui.context.open({ id: practiceId, vocalParts: [part] }, 0);
  ui.context.vocalPartAudioUrl = 'https://audio.example/new';
  await ui.tap();
  assert.equal(db.counts.inserts, 1);
  assert.equal(db.counts.updates, 1);
  assert.equal(db.rows.attachments.length, 1);
  assert.equal(db.rows.attachments[0].external_url, 'https://audio.example/new');
});

it('modal renders error/success feedback and disables editing and close controls while saving', () => {
  const modalMarkup = component.slice(component.indexOf('{vocalPartSaveNotice && ('), component.indexOf('{/* CHOIR MODAL'));
  assert.match(modalMarkup, /role="status"/);
  assert.match(modalMarkup, /role="alert"/);
  assert.match(modalMarkup, /<fieldset disabled=\{isSavingVocalPart\}/);
  assert.match(modalMarkup, /onClick=\{handleCloseVocalPartModal\}\s+disabled=\{isSavingVocalPart\}/);
  assert.match(modalMarkup, /type="submit"\s+disabled=\{isSavingVocalPart \|\| isUploadingCloudMedia\}/);
  assert.match(modalMarkup, /animate-spin/);
  assert.match(modalMarkup, /Saving…/);
});
