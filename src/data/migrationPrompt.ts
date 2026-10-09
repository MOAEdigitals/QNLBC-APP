export const MIGRATION_PROMPT_TEXT = `# QNLBC App — migration and recovery guide

Use the current MOAEdigitals/QNLBC-APP main branch as the authoritative source.

## Architecture
- React, TypeScript and Vite frontend hosted on GitHub Pages.
- Supabase PostgreSQL, Auth and Realtime hold church records, profiles and permissions.
- Cloudflare R2 stores audio/video. The qnlbc-media Worker authenticates uploads with Supabase and checks Upload permission.
- Supabase Storage holds sermon outline attachments.
- Firestore is retired. Do not restore its synchronization or upload fallback.

## Preserve during recovery
Preserve database IDs, relationships, lyrics formatting, song categories, setlist order, recording links and granular Add/Edit/Delete/Upload permissions. Apply repository migrations in order. Keep administrator checks and RLS enabled.

## Backups
Settings exports a qnlbc-database-archive containing database tables and embedded referenced recordings/outline files. Third-party links are retained as links. Authentication passwords and provider configuration are not included.

Raw database archives require administrator recovery; they are not compatible with the legacy one-click JSON importer. Restore into an isolated test project first, restore media objects and relationships, then verify record counts, playback, permissions and sign-in before any production cutover. Do not overwrite live data without a recovery plan and a fresh backup.

## Accounts and secrets
Admins manage usernames through the authenticated account functions. Never seed fixed passwords, store plaintext passwords, or include credentials in source code, exported guides or frontend bundles. Configure service credentials only in their server-side secret stores.

## Release checks
Run npm run lint, npm test, npm run build and git diff --check. Verify a complete backup and recording playback. Web releases use GitHub Pages; Android builds are manual and require the established signing key for installable updates.
`;
