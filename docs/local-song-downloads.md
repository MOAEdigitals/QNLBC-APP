# Device song downloads

Restore point: `codex/restore-before-local-downloads-20261027` at `b7033f25755884eadd360ce57d6a28f4675f8ed6`.

The Songs tab caches original media without uploading downloaded files to Supabase or R2. Android uses the pinned `io.github.junkfood02.youtubedl-android` library and FFmpeg 0.18.1 from Maven Central. YouTube downloads use a single video, prefer compatible H.264 MP4 up to 720p, and merge video/audio without converting to MP3. Direct HTTPS audio/video attachments keep their original format. There is no external conversion account or subscription.

Files are private to this app installation in Android's no-backup directory. No all-files or external storage permission is requested. The native catalog is written atomically only after a complete, nonempty file is saved. Downloads are serialized; duplicate taps reuse the existing job. Progress, cancellation and retry are exposed in the song card. Maximum file size is 250 MB. Keep the app open until downloading finishes; this version does not promise background completion after Android terminates the app. Removing a local copy does not delete a cloud song or attachment.

Browser downloads are supported for direct media URLs whose servers permit cross-origin access, using separate IndexedDB records and blobs. YouTube extraction runs only in the Android build. A downloaded track is associated by normalized source URL, so different YouTube share-link forms resolve to the same local video. Local data is per device, not shared between users/devices. Clearing app/browser storage or uninstalling removes the local files.

Lyrics for downloaded songs are saved separately in local IndexedDB. A cold Android launch without a connection offers a read-only offline Songs view. It cannot edit the shared library or bypass server authorization. A user can also open downloaded songs from the sign-in screen, because these are device files, not an authenticated cloud session.

## Third-party components

- Android wrapper: https://github.com/yausername/youtubedl-android (GPL-3.0; source, license, and binary-build instructions are in the upstream repository).
- Pinned artifacts and source archives: https://repo.maven.apache.org/maven2/io/github/junkfood02/youtubedl-android/
- yt-dlp: https://github.com/yt-dlp/yt-dlp (see upstream licensing and dependency notices).
- FFmpeg: upstream build instructions and corresponding configuration are at https://github.com/yausername/youtubedl-android/blob/master/BUILD_FFMPEG.md ; licenses depend on the bundled build configuration.

The applicable upstream license notices must accompany redistribution. Source for QNLBC changes is in this repository. Native runtime/extractor updates come from the library's official yt-dlp upstream release channel, not from YTDown. Restricted or unavailable videos are reported as failed downloads; the integration supplies no login cookies and does not attempt DRM decryption.
