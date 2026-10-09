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

## Historical media limitation (resolved in the October 2026 repair)

GitHub Pages is static and cannot run `server.ts` or `/api/upload-media`. The attachment metadata/reference synchronization is repaired, but reliable direct Cloudflare R2 uploads still need a separately deployed API (recommended: Cloudflare Worker with an R2 binding). The current Firestore fallback remains in this package temporarily so currently working recorded audio is not removed before its replacement is deployed.

## October 9, 2026 system repair

- Deployed the authenticated `qnlbc-media` Cloudflare Worker and verified upload/download hashes. Migrated 35 unique recordings and 36 attachment references to R2; retained original Firestore data and the pre-migration archive.
- Removed the Firebase SDK, legacy Firestore synchronization, and upload fallback from the application. The deny-all legacy rules are prepared for publishing after web deployment.
- Full export reads all 18 database collections, embeds referenced R2 recordings and outline files, and checks for data changes during export. Errors stop the export rather than silently omitting data. The archive excludes authentication passwords and provider configuration; raw database archives require administrator recovery rather than the legacy one-click importer.
- Applied the atomic account/profile and setlist migrations and deployed the corrected account functions. Setlist save retries use receipts; account changes retain administrator authorization checks.
- Failed refreshes retain existing visible data and show a retry warning. Memoized the Activities header filter to prevent a render loop.
- Verification: 133 tests pass, TypeScript and production build pass, production dependency audit reports zero vulnerabilities. Three moderate audit findings remain in the Capacitor CLI's xcode/uuid build-tool dependencies; no forced downgrade applied.
- Android builds are manual only. A stable release signing key/secrets must be configured before distributing the final APK. Existing APKs contain the old upload code; use the web app until the replacement APK is ready.

Never place R2 credentials, a Supabase service-role key, or database passwords in frontend code or GitHub Pages variables.
