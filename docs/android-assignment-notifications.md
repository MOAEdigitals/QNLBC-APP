# Android assignment notifications

This feature adds stable links between church directory people and Supabase accounts, assignment/update/removal notifications, an account-scoped inbox, and Saturday 9 AM Asia/Manila practice reminders for the upcoming Sunday.

## Current deployment requirements

The feature branch is tested against an isolated PostgreSQL database and mocked notification transport. The **QNLBC Supabase project** (`gprarwhcvqxjguswmkbe`) is accessible through the MOAEdigitals connection. No changes should be applied to Remindful.

Verified on October 25, 2026: the additive notification migration and account Edge Functions are deployed, notification tables have RLS, and `qnlbc-saturday-practice` is active at `0 1 * * 6` UTC. No accounts are linked to directory identities yet. Android package `com.qnlbc.churchapp` is registered in the existing Firebase project `gen-lang-client-0962729018`, and FCM HTTP v1 is enabled.

The dedicated `qnlbc-notification-sender` service account has only the Firebase Cloud Messaging API Admin project role. Its public certificate is registered with Google; its private credential and dispatcher authentication secret are stored as encrypted Supabase Edge Function secrets. Vault contains the matching scheduler secret and project URL. The `enable_assignment_push_dispatch_schedule` migration activates `qnlbc-push-delivery` once per minute. An authenticated dispatcher check returned HTTP 200 with zero messages sent (no devices are registered yet). The uploaded certificate expires on October 25, 2027 and must be rotated before then. No billing account, trial, subscription, or paid-plan upgrade was activated; Firebase remains on Spark and QNLBC Supabase on Free.

`ANDROID_GOOGLE_SERVICES_JSON` is configured in the signed-release workflow. The browser blocked config downloads, so the minimal Android config was reconstructed from the verified Firebase app ID, package, project number, project ID, and Android client API key shown in the consoles. The private sender credential is separate and is never included in the APK.

Still pending: a new signed APK, explicit admin account-directory links, and physical-device delivery verification. A successful dispatcher check alone does not establish delivery to a phone.

The local/mobile integration includes Thursday–Wednesday birthday recognition, removal of the separate Reduce button, and velocity-sensitive pull-down dismissal from the top of the song list. Safe-area clearance is applied once at the picker viewport. All 224 app tests, TypeScript and the production build pass for this integration. Physical-device notification delivery is still unverified.

Android background delivery uses Firebase Cloud Messaging (FCM). Firestore is not used or restored. Church data and the notification queue remain in Supabase, and existing media remains in Cloudflare R2. FCM receives a device token and the notification payload for delivery.

## Activation order

1. Inspect the live QNLBC schema and reconcile it with `test/assignment_schema_fixture.sql`. Take an administrator backup before applying the additive migration. The fixture is a test contract, not a production schema export.
2. Apply `supabase/migrations/20261025031548_assignment_notifications.sql` to QNLBC. It preserves legacy directory names and setlists. It binds existing setlist names only to an exact, unique directory name, and does not notify historical assignees. Existing accounts must be explicitly linked by an administrator; accounts are never automatically linked by display-name guesses.
3. Deploy the updated `admin-create-user` and `admin-update-user` Edge Functions. Their account-to-person link is stored in admin-controlled Auth `app_metadata` and mirrored atomically to `profiles.directory_member_id` by Auth triggers. Client-editable `user_metadata` cannot change the link.
4. Register Android package `com.qnlbc.churchapp` for FCM. Add its Android `google-services.json` as the GitHub Actions secret `ANDROID_GOOGLE_SERVICES_JSON`. This is Android client configuration; do not put a service-account private key in it.
5. Set `FCM_SERVICE_ACCOUNT_JSON` and a random `NOTIFICATIONS_CRON_SECRET` as **Supabase Edge Function secrets**. Never add these to frontend environment variables, the repository, or an APK.
6. Deploy the `assignment-notifications` Edge Function with `verify_jwt = false`. This server-only endpoint checks `x-notification-secret` itself before any database or provider call. Missing secrets disable delivery; requests do not fall back to unauthenticated access.
7. Store the QNLBC URL as `project_url` and the same dispatch secret as `notification_dispatch_secret` in Supabase Vault. Run `supabase/setup_assignment_notification_schedule.sql`. It schedules `0 1 * * 6` UTC (Saturday 9 AM Philippine time) for reminders, plus a once-per-minute delivery worker.
8. Review Supabase security/performance advisors and verify table grants/RLS. Ship the frontend and build a new signed release APK. The Android workflow enables native registration only when Android FCM configuration is supplied. A build without it explains that push notifications are unavailable, rather than claiming delivery works.
9. In Settings → Members & permissions, edit each participating account and select its church directory person. In the Android app, open Notifications and tap Enable notifications. No permission prompt is shown automatically at login.

## Behavior and safeguards

- Each directory person can be linked to one account. Username is a separate login identifier. Directory renames update linked profile names and existing assignment names while retaining person IDs.
- An ordinary setlist save or song edit does not resend assignments. Recipient/date changes generate events in the same database transaction as the setlist save, so a failed save cannot publish a notification.
- Presider, Sunday School song leader, Worship Service song leader, and other-program song leader assignments are supported. Practice reminders cover Sunday-service setlists for the next day, using their latest saved assignments.
- Directory people without a linked active account remain valid assignees. The setlist editor warns that they cannot receive notifications. Archiving is blocked while someone has an account or upcoming assignments.
- Users can read only their own notification inbox and mark only their own messages read. Clients cannot insert notifications, read device tokens, claim deliveries, or acknowledge provider results.
- Device registrations belong to the signed-in account. Logout revokes the server registration and unregisters the native token. Stale JavaScript callbacks cannot register a device for a prior account. Queued delivery checks account activity, installation ownership, assignment identity and date before sending.
- Retries use per-device delivery rows, leases and bounded backoff. FCM notification tags use the notification ID to replace duplicate visible notifications. Delivery is at least once; network failures cannot guarantee exactly-once transport. Invalid provider tokens are removed.
- The inbox shows the latest 100 notifications. The backup includes directory identities and profile links; device tokens and delivery state are intentionally excluded. Authentication credentials still require administrator recovery, as before.

## Required end-to-end checks before activation is considered complete

Use two test accounts and an Android phone. Check initial assignment, unchanged save, reassignment/removal, date changes, denied/granted permission, foreground/background/terminated-app delivery, notification tap after login, logout/account switching, token refresh and duplicate/retried saves. Verify Saturday reminders using an isolated database clock fixture, then inspect the production cron configuration without sending a mass test to members.

A green build or mocked FCM test does not establish live delivery. The QNLBC migration, scheduler, FCM credentials and physical-device tests must be completed before reporting this feature as active.

References: [Capacitor Android push setup](https://capacitorjs.com/docs/apis/push-notifications), [FCM HTTP v1](https://firebase.google.com/docs/cloud-messaging/send/v1-api), [Supabase scheduling](https://supabase.com/docs/guides/functions/schedule-functions).
