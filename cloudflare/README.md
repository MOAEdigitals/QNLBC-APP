# QNLBC media upload service

`media-worker.mjs` replaces the static site's unauthenticated Firestore upload fallback. The Worker is deployed at `https://qnlbc-media.aigems2026.workers.dev` with the R2 binding and Supabase public key configured.

## Migration verification — 2026-10-09

- Saved the original full archive before changing recording references.
- Copied 35 unique recordings to R2; downloaded every copy and verified its SHA-256 hash against the original bytes.
- Updated 36 attachment references with revision and original-URL checks. Zero Firestore attachment references remained.
- Verified anonymous uploads return HTTP 401 and an authenticated upload downloads with the same hash.
- Original Firestore recordings are retained. Publish the restrictive `firestore.rules` only after the web cutover; do not delete the archive.
- Old APKs still contain the former upload code. Use the updated web app until a new APK is released.

## Deployment configuration

- Worker name: `qnlbc-media`
- R2 binding: `AUDIO_BUCKET` → the existing `worship-audio` bucket
- Variable: `SUPABASE_PUBLISHABLE_KEY` → the project's public publishable key (never a service-role key)
- Upload route: `POST /api/upload-media`
- Request: raw audio/video bytes, Supabase bearer token, MIME Content-Type, optional URL-encoded `X-File-Name`
- Limit: 50 MiB, enforced on the received body as well as Content-Length

The Worker verifies the user with Supabase Auth, then reads that user's active status and Upload permission through RLS. It exposes no delete or list endpoint. SHA-256 object keys make retries reuse the same content without overwriting a different recording. The response is returned only after R2 confirms the size and stored hash metadata.

## Cutover checklist

1. Save and inspect a full archive including all referenced Firestore recordings.
2. Deploy this Worker and its binding with the owner's approval.
3. Verify live unauthorized requests fail and an authorized upload can be downloaded with an identical SHA-256 hash.
4. Copy each referenced legacy recording; verify downloaded bytes before updating the corresponding database reference, with revision checks.
5. Switch new application uploads to the authenticated endpoint. Keep original recordings until migration and playback are verified.
6. Restrict the legacy Firebase database only after the cutover is confirmed. Do not change other Firebase databases in the same project.

The existing R2 public bucket remains public for playback. Never put Cloudflare credentials or a Supabase service-role key in frontend code.
