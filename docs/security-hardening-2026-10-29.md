# Security and category UI update

Checkpoint: `codex/security-ui-checkpoint-2026-10-29` at b061cf3. Database/auth settings have their own checkpoint evidence outside the repository; reverting Git does not reverse those settings.

- Disable public Supabase self-registration; administrator account creation remains the supported path.
- New/reset passwords require 10 characters. Existing passwords still work. No account credentials were reset.
- Username login uses service-only shared database counters: eight attempts per normalized handle per minute and 120 total per minute. Limits apply before account lookup and fail closed on counter errors. Request bodies are capped at 4 KiB. Counters store hashes, not passwords or raw usernames; these hashes are not intended as anonymization. Supabase Auth's own limits remain in place.
- Revoke unnecessary table-wide privileges and anonymous privileged-function execution; preserve member RPC permissions. New accounts default to no media upload permission; existing account permissions are unchanged.
- Remove the unused unauthenticated Express/R2 server and its dependencies. Source export uses the public GitHub source archive. Publish browser assets only.
- Update affected dependencies within supported version ranges; pin Supabase client and CI action revisions. npm audit returned zero advisories at implementation time; this is not a security guarantee.
- Build a compatible CSP blocking unauthorized scripts, plugin objects and external base/form targets, with hashes for the existing startup script. It does not restrict every network/media destination. GitHub Pages response headers cannot be configured by this code.
- Disable Android backup/transfer of app data, narrow FileProvider access to the shared image cache, and keep image sharing in that directory. Device behavior still needs handset verification.
- Songs categories and the Schedules/Recognitions sub-tabs share neutral styling; only selection uses the existing blue theme accent. Preserve light/dark themes and filtering behavior.

Validation includes 255 app tests, typecheck, production build, focused login tests, SQL counter block/recovery tests and live member/anonymous access checks. No member records, songs, notes, or notifications were removed, and no push message was sent. No paid service was enabled. The optional paid leaked-password feature remains disabled.
