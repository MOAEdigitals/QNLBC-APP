# QNLBC interface standards

## UI rollback, November 8, 2026

The user restored the interface to `restore/qnlbc-before-ios-ui-2026-11-08` (`bccf16393c45d91ab3b724d57781ec3fd1333e3e`). Do not reintroduce the rejected floating navigation, grouped-settings redesign or compact grouped Activities/Recognitions/Choir rows without a new request. Keep the existing security protections and the corrected browser close/refresh warning: ordinary browsing/search and untouched editors do not warn; actual unsaved form edits do. Preserve the independent native/web Back/Exit confirmation. This rollback changes presentation only; live database records are not reverted.

- Use `SheetSelect` for selection fields; retain option values, disabled choices and required validation. Native HTML select menus are not part of the app UI.
- Use `SheetDateField` for date, local date/time and time fields. Its change values retain the existing ISO date and 24-hour time formats.
- Use `BottomSheet` for pickers and filtered lists on desktop and mobile. Include a handle, title, close action, clear selection states and optional search. Back, Escape and backdrop dismiss the top sheet; keyboard focus returns to the opener.
- Use `await confirmAction(message)` before a consequential action and return when it resolves false. Use `showAppMessage` for app notices. The app host renders these as sheets; do not use native alert/confirm/prompt dialogs.
- Dark colors: background `#0a0f1d`, surface `#131c31`, field `#0d1527`, border `#1f2d4a`, primary `#1d63ed`, white text, muted `#8e9bb0`. Use the shared CSS variables and existing primary/secondary button classes.
- Fields have labels above them and rounded, recessed surfaces. Sheet controls have at least 44px touch targets and respect safe areas, keyboard viewport height and reduced motion.
- Full-screen editors and action overflow menus remain distinct from selection fields. Preserve existing permissions, validation and save behavior when changing presentation.
