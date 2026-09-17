# Authoritative Repair Notes - New Practice Session Lifecycle

## Defect Summary
- **Original Error**: `"Unable to save practice: Cannot coerce the result to a single JSON object"`
- **Root Cause**: The application previously added newly initiated practices to React state with temporary client-side IDs without first performing a database `INSERT`. When saving, it attempted an `UPDATE` on a row that did not exist in `public.practice_entries`. Supabase returned 0 rows, triggering the PostgREST `PGRST116` error on `.single()`.

## Authoritative Corrections Applied
1. **Creation Flow Separation**:
   - `createPracticeEntry` performs an explicit `INSERT` into `public.practice_entries` using `.insert(payload).select('*').single()`.
   - New practices omit client-side IDs completely, allowing Supabase to generate the authoritative UUID.
2. **Payload Sanitization**:
   - `buildPracticePayload` enforces the exact 12 columns in `public.practice_entries`:
     - `group_name`
     - `target_date`
     - `practice_date`
     - `practice_time`
     - `assigned_event`
     - `song_id`
     - `song_title`
     - `lyrics_mode`
     - `lyrics_snapshot`
     - `source_song_revision`
     - `notes`
     - `is_done`
   - Strips all frontend-only metadata (`vocalParts`, `customAttachments`, `tracks`, `createdAt`, `updatedAt`, `revision`, `trackCount`).
3. **Update Flow**:
   - `updatePracticeEntry` performs `UPDATE` matching by verified `id`.
   - `.single()` is retained (never bypassed with `.maybeSingle()`).
   - If an update returns 0 rows (`PGRST116`), phantom items are cleared from state, Supabase is refetched, and the user is alerted.
4. **CI & Workflow Alignment**:
   - Kept `.github/workflows/deploy.yml` for unified GitHub Pages deployment.
   - Removed `.github/workflows/static.yml` to avoid dual-workflow conflicts.
   - Standardized `npm test` with Node's native test runner (`node --import tsx --test test/*.test.ts`).
