# Back navigation audit — 24 October 2026

Scope: all main tabs, form/modal owners, song/name pickers, nested dialogs, action menus, fullscreen readers, and the Android Back bridge. This is an audit, not a rewrite of the Back system. No Back handlers were changed in this update.

## Confirmed issues

| Flow | Actual behavior | Expected behavior | Evidence |
| --- | --- | --- | --- |
| Choir → expand a card → Add attachment → Back | The expanded Choir card and its attachment form both close. | Close only the attachment form, leaving the Choir card expanded. | Reproduced using the real `ChoirMedia` component and `useBackLayer`, with the same parent/child mounting order as Schedules. No data was saved. |
| Setlist share preview → close with X → Back | X unmounts the dialog but leaves its history entry. The next Back can return to the same tab instead of the preceding screen. | X should consume the preview's own history entry. | Reproduced with the real hook and the share dialog's conditional-mount lifecycle. |
| Schedule song → open song picker → Back | The whole schedule form closes, rather than just the picker. | Dismiss the picker first. | Reproduced on the published web app without selecting a song or saving. The shared song/name picker has no Back layer, so other forms using it have the same structural gap. The Android touch sheet uses that same component; physical-device confirmation is still needed. |
| Outlines → open a three-dot action menu → Back | The menu remains open and the app's Exit prompt appears when this is the root tab. | Dismiss the action menu first. | Reproduced on the published web app. Shared `CardActions` and native-details menus lack a Back layer. This also affects their Activities, Choir and Song Numbers usages. |

The nested Choir conflict comes from the older parent listener consuming `popstate` before the newer child listener. `useBackLayer` currently checks whether its layer is active/pushed, but does not verify that it owns the top history entry. A global change here would affect Songs/Setlists too, so it was deliberately left for a targeted follow-up.

## Coverage and protected behavior

| Area | Audit result |
| --- | --- |
| Main navigation / Android bridge | Android Back delegates to browser history. The root Exit/Cancel guard is present. Edge-back operating-system behavior and keyboard dismissal require a physical-device pass. |
| Outlines reader / editor | Reader Back returns to the list; toolbar Back and reopening pass the existing component test. Editor discard/save guards remain present. Content-search and session-cache tests also pass. Shared action-menu issue listed above. |
| Activities forms | Own Back layer with save guard. Shared action-menu and song/name-picker gaps apply. |
| Song Numbers / Choir / Practice | Shared parent Back handler closes the active form/detail and retains save/upload locks. Nested Choir attachment and picker issues are listed above. |
| Recognitions | Birthday menu and Birthday/Anniversary/Special forms register their Back owner. Name-picker gap applies. |
| Settings / member screens / database-status modal | Section/member/create/edit/prompt owners and save locks are present. The database-status modal registers its own Back layer. These were source-audited; account mutations were not performed. |
| Songs | Existing return-to-origin-setlist flow, fullscreen exit, edit/upload locks and card-collapse logic were not changed. Fullscreen owns its Back layer while the parent song layer is disabled. Only the muted scheduling/history text and the requested scheduled-link playback entry were changed; no Back handlers were changed. |
| Setlists | Existing first-Back warning / second-Back-within-3.5-seconds exit for dirty edits was not changed. Card expansion, one-open-card behavior, remembered expansion, song-return scroll restoration and drag ordering were not changed. Picker/share issues are reported without altering these special flows. |

## Changes delivered alongside the audit

- Use the supplied transparent logo for web and Android brand assets.
- Keep the single Android launch splash visible until initial app loading finishes, then reveal the ready app directly. Remove the second React splash, connection message and skeletons. Both native and web startup show the transparent logo with “New Life Baptist Church” underneath.
- Keep the last authorized outline list in memory for the signed-in account. Re-entry renders it immediately while refreshing from the server in the background. Sign-out/sign-in resets this cache; reload starts fresh. Reader/editor state still resets as before on tab changes.
- Song Numbers now uses compact playback/library controls instead of inline performance lyrics; its attached link opens the existing Song Library player.
- Song subtitle priority is now **Currently scheduled → Last sung → Not scheduled yet**, with only one of those three visible at a time.

Validation: 213 automated tests passed, including actual outline Back/search and deferred background-refresh coverage. Web production build passed. No production records were created, edited or deleted during the audit. Full physical Android gesture/keyboard testing remains unverified.
