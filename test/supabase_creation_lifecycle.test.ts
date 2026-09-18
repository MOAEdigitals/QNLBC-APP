import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const dataLayer = readFileSync(new URL('../src/services/supabaseData.ts', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const permissionsMigration = readFileSync(
  new URL('../supabase/migrations/20260918_granular_user_permissions.sql', import.meta.url),
  'utf8'
);

describe('Supabase record creation lifecycle', () => {
  it('uses database-generated UUIDs for new top-level records', () => {
    const insertCalls = [
      ".from('songs')\n      .insert(payload)",
      ".from('setlists')\n      .insert(setlistPayload)",
      ".from('special_numbers')\n      .insert(payload)",
      ".from('choir_entries')\n      .insert(payload)",
      ".from('practice_entries')\n    .insert(validPayload)",
      ".from('birthdays')\n      .insert(payload)",
      ".from('anniversaries')\n      .insert(payload)",
      ".from('visitors')\n      .insert(payload)",
      ".from('recognitions')\n      .insert(payload)",
    ];

    for (const call of insertCalls) {
      assert.ok(dataLayer.includes(call), `Missing authoritative insert: ${call}`);
    }
    assert.equal(dataLayer.includes('.insert(insertPayload)'), false);
  });

  it('passes an explicit creation decision from application state', () => {
    const requiredCalls = [
      'supabaseSaveSetlist(newOrUpdated, isNew)',
      'supabaseSaveSong(newOrUpdated, isNew)',
      'supabaseSaveSpecialNumber(entryToSave, isNew)',
      'supabaseSaveChoirEntry(entryToSave, isNew)',
      'supabaseSaveBirthday(item, isNew)',
      'supabaseSaveAnniversary(item, isNew)',
      'supabaseSaveVisitor(item, isNew)',
      'supabaseSaveSpecialRecognition(item, isNew)',
    ];

    for (const call of requiredCalls) {
      assert.ok(app.includes(call), `Creation mode is not explicit for ${call}`);
    }
  });

  it('does not add new songs or setlists to shared state before Supabase succeeds', () => {
    const setlistHandler = app.slice(
      app.indexOf('const handleSaveSetlist'),
      app.indexOf('const handleDeleteSetlist')
    );
    const songHandler = app.slice(
      app.indexOf('const handleSaveSong'),
      app.indexOf('const handleBatchSaveSongs')
    );

    assert.ok(
      setlistHandler.indexOf('await supabaseSaveSetlist') < setlistHandler.indexOf('setSetlists'),
      'Setlist state must update only after the database insert/update resolves'
    );
    assert.ok(
      songHandler.indexOf('await supabaseSaveSong') < songHandler.indexOf('setSongs'),
      'Song state must update only after the database insert/update resolves'
    );
  });

  it('persists and reloads practice-track and vocal-part attachment metadata', () => {
    assert.ok(dataLayer.includes(".from('attachments')"));
    assert.ok(dataLayer.includes(".eq('owner_type', 'practice')"));
    assert.ok(dataLayer.includes(".eq('owner_type', 'vocal_part')"));
    assert.ok(dataLayer.includes("await syncOwnerAttachments(\n    'practice'"));
    assert.ok(dataLayer.includes("await syncOwnerAttachments(\n      'vocal_part'"));
    assert.ok(dataLayer.includes('customAttachments: attachments'));
    assert.ok(dataLayer.includes('audioUrl: audioAttachment?.external_url'));
  });

  it('saves member vocal contributions without updating the parent practice', () => {
    assert.ok(dataLayer.includes('export async function savePracticeVocalPart'));
    assert.ok(app.includes('supabaseSavePracticeVocalPart(practiceId, part, position)'));
    const memberSave = dataLayer.slice(
      dataLayer.indexOf('export async function savePracticeVocalPart'),
      dataLayer.indexOf('export async function createPracticeEntry')
    );
    assert.equal(memberSave.includes(".from('practice_entries')\n    .update"), false);
  });

  it('enforces granular permissions in Supabase and keeps upload ownership scoped', () => {
    assert.ok(permissionsMigration.includes('can_add boolean not null default false'));
    assert.ok(permissionsMigration.includes('can_edit boolean not null default false'));
    assert.ok(permissionsMigration.includes('can_delete boolean not null default false'));
    assert.ok(permissionsMigration.includes('can_upload boolean not null default true'));
    assert.ok(permissionsMigration.includes("public.has_permission('upload')"));
    assert.ok(permissionsMigration.includes('created_by = (select auth.uid())'));
    assert.ok(permissionsMigration.includes("owner_type = 'vocal_part'"));
    assert.ok(permissionsMigration.includes("owner_type = 'practice'"));
    assert.ok(dataLayer.includes('export async function savePracticeAttachment'));
  });
});
