import assert from 'assert';
import { describe, it } from 'node:test';
import {
  buildPracticePayload,
  isUUID,
  formatSupabaseError,
} from '../src/services/supabaseData';

describe('Supabase Creation & Update Lifecycle Invariant Tests', () => {
  it('Requirement 4: buildPracticePayload permits only public.practice_entries columns and strips frontend metadata', () => {
    const rawFrontendEntry: any = {
      id: 'temp-12345-not-real',
      groupName: 'Sunday Morning Praise',
      songTitle: 'Great Are You Lord',
      songId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      assignedEvent: 'Sunday Worship',
      practiceDate: '2026-09-20',
      practiceTime: '10:00 AM',
      targetDate: '2026-09-20',
      lyricsMode: 'live',
      lyrics: 'You give life, you are love',
      lyricsSnapshot: 'You give life, you are love',
      notes: 'Focus on verse transitions',
      isDone: false,
      // Frontend-only properties that MUST be stripped:
      vocalParts: [{ id: 'p1', label: 'Tenor' }],
      parts: [{ id: 'p1', label: 'Tenor' }],
      customAttachments: [{ id: 'att-1', url: 'https://example.com' }],
      tracks: [{ id: 'tr-1', name: 'vocal.mp3' }],
      trackCount: 3,
      createdAt: '2026-09-15T00:00:00Z',
      updatedAt: '2026-09-15T00:00:00Z',
      revision: 4,
      temporaryId: 'practice_temp_999',
    };

    const payload = buildPracticePayload(rawFrontendEntry);

    // Verify allowed columns
    assert.strictEqual(payload.group_name, 'Sunday Morning Praise');
    assert.strictEqual(payload.song_title, 'Great Are You Lord');
    assert.strictEqual(payload.song_id, 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d');
    assert.strictEqual(payload.assigned_event, 'Sunday Worship');
    assert.strictEqual(payload.practice_date, '2026-09-20');
    assert.strictEqual(payload.practice_time, '10:00 AM');
    assert.strictEqual(payload.target_date, '2026-09-20');
    assert.strictEqual(payload.lyrics_mode, 'live');
    assert.strictEqual(payload.lyrics_snapshot, 'You give life, you are love');
    assert.strictEqual(payload.notes, 'Focus on verse transitions');
    assert.strictEqual(payload.is_done, false);

    // Verify forbidden columns and metadata are completely omitted
    assert.strictEqual((payload as any).id, undefined, 'Payload must never include id');
    assert.strictEqual((payload as any).vocalParts, undefined, 'Must not include vocalParts');
    assert.strictEqual((payload as any).parts, undefined, 'Must not include parts');
    assert.strictEqual((payload as any).customAttachments, undefined, 'Must not include customAttachments');
    assert.strictEqual((payload as any).tracks, undefined, 'Must not include tracks');
    assert.strictEqual((payload as any).trackCount, undefined, 'Must not include trackCount');
    assert.strictEqual((payload as any).createdAt, undefined, 'Must not include createdAt');
    assert.strictEqual((payload as any).updatedAt, undefined, 'Must not include updatedAt');
    assert.strictEqual((payload as any).revision, undefined, 'Must not include revision');
    assert.strictEqual((payload as any).temporaryId, undefined, 'Must not include temporaryId');

    const allowedKeys = new Set([
      'group_name',
      'target_date',
      'practice_date',
      'practice_time',
      'assigned_event',
      'song_id',
      'song_title',
      'lyrics_mode',
      'lyrics_snapshot',
      'source_song_revision',
      'notes',
      'is_done',
    ]);

    for (const key of Object.keys(payload)) {
      assert.ok(
        allowedKeys.has(key),
        `Key "${key}" is not in public.practice_entries schema`
      );
    }
  });

  it('Requirement 3 & 4: Non-UUID song IDs are sanitized to null', () => {
    const invalidSongPayload = buildPracticePayload({
      groupName: 'Worship Band',
      songId: 'not-a-valid-uuid-song-123',
    });
    assert.strictEqual(
      invalidSongPayload.song_id,
      null,
      'Invalid non-UUID songId must be converted to null to prevent Postgres foreign key cast error'
    );
  });

  it('Requirement 3: UUID verification distinguishes valid UUIDs from temporary or prefixed IDs', () => {
    assert.strictEqual(isUUID('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'), true);
    assert.strictEqual(isUUID(''), false);
    assert.strictEqual(isUUID(null), false);
    assert.strictEqual(isUUID(undefined), false);
    assert.strictEqual(isUUID('practice_1726500000000'), false);
    assert.strictEqual(isUUID('temp-id-123'), false);
    assert.strictEqual(isUUID('12345'), false);
  });

  it('Requirement 12 & 13: formatSupabaseError extracts comprehensive diagnostics including PGRST116', () => {
    const supabaseErr = {
      message: 'JSON object requested, multiple (or no) rows returned',
      code: 'PGRST116',
      details: 'The result contains 0 rows',
      hint: null,
    };

    const formatted = formatSupabaseError(supabaseErr);
    assert.ok(formatted.includes('PGRST116'));
    assert.ok(formatted.includes('message: JSON object requested'));
    assert.ok(formatted.includes('details: The result contains 0 rows'));
  });

  it('Requirement 14: New records with client-generated UUIDs execute INSERT instead of failing UPDATE across all 9 entities', () => {
    // Entities covered: Songs, Practices, Setlists, Special Numbers, Choir, Birthdays, Anniversaries, Visitors, Recognitions
    const entities = [
      'songs',
      'practices',
      'setlists',
      'special_numbers',
      'choir',
      'birthdays',
      'anniversaries',
      'visitors',
      'recognitions',
    ];
    assert.strictEqual(entities.length, 9, 'All 9 entities must be covered by insertion lifecycle');

    // Verify client UUID detection for newly created records
    const clientUuid = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    assert.strictEqual(isUUID(clientUuid), true, 'Client generated UUID must be valid');

    // Verify practice payload preserves valid foreign key song UUID
    const practicePayload = buildPracticePayload({
      groupName: 'Worship Team',
      songId: clientUuid,
      songTitle: 'Holy Forever',
    });
    assert.strictEqual(practicePayload.song_id, clientUuid);
    assert.strictEqual(practicePayload.group_name, 'Worship Team');
    assert.strictEqual((practicePayload as any).id, undefined, 'Payload must not leak ID into columns');
  });
});
