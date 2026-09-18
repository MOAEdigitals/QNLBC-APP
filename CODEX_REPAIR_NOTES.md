# QNLBC Codex Repair

## Fixed in this package

- New Songs, Setlists, Special Numbers, Choir entries, Birthdays, Anniversaries, Visitors, and Recognitions now use `INSERT` rather than attempting to update a client-generated UUID that does not exist.
- New parent and child records use PostgreSQL-generated UUIDs and retain the rows returned by Supabase.
- Shared UI state is updated only after Supabase confirms the write.
- New Practice Sessions use the repaired insert-first flow.
- When a new Practice, Special Number, or Choir entry creates a linked Song, the Song is inserted first and its returned UUID is used as the foreign key.
- Setlist items and vocal parts use database-generated UUIDs.
- Rehearsal-track metadata is now written to and loaded from `public.attachments` with `owner_type = 'practice'`.
- Vocal-part audio references are now written to and loaded from `public.attachments` with `owner_type = 'vocal_part'`.
- Track and vocal-part editors wait for Supabase confirmation before closing.
- Realtime attachment changes now refresh practice data across signed-in browsers.
- Added a working `npm test` command and Supabase creation-lifecycle regression tests.
- Removed the duplicate GitHub Pages deployment workflow.
- Corrected the production Express bundle to ESM so `import.meta.url` works.
- Added granular per-user Add, Edit, and Delete permissions managed by administrators.
- Active members retain Upload permission and now save vocal recordings without updating the parent practice.
- Added ownership-scoped RLS policies for member-created vocal parts and their attachment metadata.

## Required Supabase migration

Run `supabase/migrations/20260918_granular_user_permissions.sql` once in the Supabase SQL Editor before deploying this frontend.

## Verification completed

- `npm run lint` passes.
- `npm test` passes: 15 tests.
- `npm run build` passes.

## Still requires a separate deployment task

GitHub Pages is static and cannot run `server.ts` or `/api/upload-media`. The attachment metadata/reference synchronization is repaired, but reliable direct Cloudflare R2 uploads still need a separately deployed API (recommended: Cloudflare Worker with an R2 binding). The current Firestore fallback remains in this package temporarily so currently working recorded audio is not removed before its replacement is deployed.

Never place R2 credentials, a Supabase service-role key, or database passwords in frontend code or GitHub Pages variables.
