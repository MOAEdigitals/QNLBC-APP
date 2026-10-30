# QNLBC media upload service

## Setlist link previews — 2026-10-31

`POST /api/share-setlist?setlist=<uuid>` accepts a PNG card (maximum 3 MiB). It verifies the current Supabase user, active profile and access to the saved, non-deleted setlist through the caller's JWT and existing RLS. It never uses a service-role key. Only the explicit **Create preview link** action publishes a card.

Snapshots live under the separate R2 `setlist_previews/` prefix. Create-only content-addressed objects reuse identical cards and preserve old links after edits. Public `/share/<hash>/<token>` pages contain server-rendered Open Graph metadata; `/image.png` returns the saved PNG. Browsers continue to the exact setlist URL in the app, where existing login and access checks remain in force. The exported card is visible to anyone with its preview link; it is not a private database endpoint. No listing endpoint is exposed.

The web dialog prepares the link first, then shares just that URL on a fresh user gesture. It keeps image download and app-link copying available. Recipient apps control whether and how they show the preview; a successful native-share return does not prove a message was sent or a preview rendered. Messenger delivery must be checked on a recipient device. No message is automatically sent by the app.

This uses the existing Worker and R2 bucket. No subscription or billing configuration is changed.

Preview fetch correction: public snapshot reads accept social-network Origin headers, while authenticated creation retains the application-origin restriction. Open Graph images now use the direct public R2 PNG URL, and newly created links carry `?v=2` to avoid reusing previously cached missing-image metadata. The old Worker image endpoint remains valid. Messenger may still display a raw URL or decline a preview; the app cannot force native Facebook-post presentation. **Share photo only — no link** sends a photo attachment without any URL; it intentionally does not navigate to the setlist when tapped.

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
