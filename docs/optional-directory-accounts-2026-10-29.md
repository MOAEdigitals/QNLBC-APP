# Accounts with optional directory links

Accounts and the ministry directory have separate purposes. Administrators can create or edit an account with a free-form name and no directory link, including pastor and AVP accounts. The directory remains the list of people available as song leaders/presiders.

Selecting a directory identity uses its canonical name and continues to enforce one account per person. Choosing “No directory link” on an existing account explicitly clears trusted Auth app metadata; the Auth trigger updates the profile in the same transaction. Omitting the selection in older API clients preserves their existing link. Ordinary users still cannot administer accounts or change their own directory identity.

The current database already delivers birthdays (7 AM on the day), special events (8 AM the day before), and custom announcements to active accounts without a directory requirement. Android delivery requires installed notification registration/permission. Assignment/practice notifications remain tied to the selected directory identity. No notification schedule, permission model, existing account, or directory record is changed by this update.

Validation: account endpoint tests cover independent creation, canonical links, unlinking, older-client updates, invalid IDs and non-admin denial. Isolated database tests verify profile link/unlink synchronization and birthday/event/custom inbox and device delivery for an unlinked account. Test identities and notifications roll back; nothing is sent to real users.

Checkpoint: `codex/optional-directory-checkpoint-2026-10-29` at 6ea1531.
