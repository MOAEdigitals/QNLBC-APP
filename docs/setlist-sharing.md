# Setlist sharing

The card menu opens a share preview without changing the live accordion. The export is a mobile-width PNG with the full song-leader sections, person colors and blue/green background. Sharing passes the PNG and an HTTPS link to the device share sheet. The user chooses Messenger and the recipients. Messenger controls whether it keeps the accompanying text/link; Copy link and Download image are available separately. Browsers without file sharing send the link instead.

The URL is `https://moaedigitals.github.io/QNLBC-APP/?setlist=<UUID>#home`. The destination waits for the usual login and authorized setlist loading, opens only that card, then consumes the request. Deleted/inaccessible IDs show an unavailable message. No public database access or anonymous preview endpoint was added. The attached PNG is a snapshot; the link opens the latest saved record. A pasted URL alone currently has the normal site preview, not an automatically generated per-setlist Messenger thumbnail.

## Android readiness

Official Capacitor Share and Filesystem plugins are registered. Images are written to app cache for native sharing. The app listens for both cold-start and running-app URLs, but automatic HTTPS app opening is **not activated** until verified Android App Links are configured and an updated APK is installed.

GitHub Pages can remain the host. Domain verification must be served at the **host root**:
`https://moaedigitals.github.io/.well-known/assetlinks.json`

A file under `/QNLBC-APP/.well-known/` does not satisfy Android verification. Hosting the root file requires the account's root Pages site (normally the `moaedigitals.github.io` repository), or a later custom domain. The statement must name `com.qnlbc.churchapp` and the actual installed app's public SHA-256 signing-certificate fingerprint (Play App Signing's fingerprint for Play installs). Do not publish a keystore or signing password.

Once root hosting and the release certificate are available:
1. Publish the Digital Asset Links statement at that root URL over HTTPS, without redirects.
2. Add an `android:autoVerify="true"` VIEW/BROWSABLE/DEFAULT intent filter for HTTPS host `moaedigitals.github.io`, restricted to `/QNLBC-APP/`, in MainActivity's manifest entry.
3. Build and install the updated Android app, then verify link association on a device.
4. Test the same shared URL with the app installed, with it stopped/running, without it installed, and with a signed-out account. Messenger's in-app browser can still influence how it hands links to Android.

Documentation: https://developer.android.com/training/app-links/about and https://capacitorjs.com/docs/apis/share
