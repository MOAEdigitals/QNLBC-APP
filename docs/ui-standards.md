# QNLBC interface standards

- Use `SheetSelect` for selection fields; retain option values, disabled choices and required validation. Native HTML select menus are not part of the app UI.
- Use `SheetDateField` for date, local date/time and time fields. Its change values retain the existing ISO date and 24-hour time formats.
- Use `BottomSheet` for pickers and filtered lists on desktop and mobile. Include a handle, title, close action, clear selection states and optional search. Back, Escape and backdrop dismiss the top sheet; keyboard focus returns to the opener.
- Use `await confirmAction(message)` before a consequential action and return when it resolves false. Use `showAppMessage` for app notices. The app host renders these as sheets; do not use native alert/confirm/prompt dialogs.
- Dark colors: background `#0a0f1d`, surface `#131c31`, field `#0d1527`, border `#1f2d4a`, primary `#1d63ed`, white text, muted `#8e9bb0`. Use the shared CSS variables and existing primary/secondary button classes.
- Fields have labels above them and rounded, recessed surfaces. Sheet controls have at least 44px touch targets and respect safe areas, keyboard viewport height and reduced motion.
- Full-screen editors and action overflow menus remain distinct from selection fields. Preserve existing permissions, validation and save behavior when changing presentation.
