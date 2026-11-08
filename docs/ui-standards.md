# QNLBC interface standards

## iOS-inspired refinement, November 8, 2026

Reference: [Apple Designing for iOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-ios/), [Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets), and [Reduced Motion](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria). Organized's `docs/design-direction.md` informed compact headers, blue selected navigation, stable control bounds and accessibility. This is a shared web/Android interface, not a native iOS port or an Apple Liquid Glass reproduction.

- Keep five existing tabs and their re-tap behaviors. A floating, opaque surface has persistent labels and a blue selected capsule. Labels do not shrink at large text sizes; the bar scrolls horizontally when they need more room. Measure the entire navigation wrapper, including safe-area spacing, so content/FAB clear it. Do not scale selected icons or change tab geometry on selection.
- Header actions use stable 44px bounds; titles can wrap. Preserve user-chosen fonts, light/dark appearance and zoom. Prefer readable hierarchy and compact sections over shrinking tap targets.
- Use one blue accent for actions/selection; preserve semantic destructive colors and user-requested birthday/special/next-up highlights. Keep shadows for floating overlays/navigation. No arbitrary gradients, decorative icon tiles or dashboard statistics.
- Sheets enter in 220ms and exit in 180ms; popovers originate at the trigger side at .95 scale. Sheet header dragging tracks the pointer directly without transition lag. Reduced motion disables these effects; high contrast strengthens selection outlines.
- Preserve query ranking/scroll behavior, top-layer dismissal, selection toggles, drag/reorder, back/exit handling, notification read rules and save/permission checks. Existing full-screen editors remain full screen. Progressive form redesign is a separate flow-by-flow change, not a mandatory wizard.
- Do not add row stagger, spring overshoot, blur effects or debounce delays without a demonstrated need. Existing deferred search, lazy loading and pagination stay in place. Do not add dependencies for cosmetic effects.
- Security/data hygiene remain engineering requirements, not visual work. Do not claim an authentication/RLS/backend audit from a UI pass; schema/index/security changes require separate evidence.

Restore point before this refinement: Git tag `restore/qnlbc-before-ios-ui-2026-11-08`, commit `bccf16393c45d91ab3b724d57781ec3fd1333e3e`. This contains tracked source, including title-priority search and bracketed song copy. It excludes live database records, credentials and untracked local files. To inspect safely, create a branch at the tag; do not reset/delete current work. Restoring the deployed app means deploying that source again, with a new Android version code if an APK is later requested.

## Existing interaction rules

- Use `SheetSelect` for selection fields; retain option values, disabled choices and required validation. Native HTML select menus are not part of the app UI.
- Use `SheetDateField` for date, local date/time and time fields. Its change values retain the existing ISO date and 24-hour time formats.
- Use `BottomSheet` for pickers and filtered lists on desktop and mobile. Include a handle, title, close action, clear selection states and optional search. Back, Escape and backdrop dismiss the top sheet; keyboard focus returns to the opener.
- Use `await confirmAction(message)` before a consequential action and return when it resolves false. Use `showAppMessage` for app notices. The app host renders these as sheets; do not use native alert/confirm/prompt dialogs.
- Dark colors: background `#0a0f1d`, surface `#131c31`, field `#0d1527`, border `#1f2d4a`, primary `#1d63ed`, white text, muted `#8e9bb0`. Use the shared CSS variables and existing primary/secondary button classes.
- Fields have labels above them and rounded, recessed surfaces. Sheet controls have at least 44px touch targets and respect safe areas, keyboard viewport height and reduced motion.
- Full-screen editors and action overflow menus remain distinct from selection fields. Preserve existing permissions, validation and save behavior when changing presentation.
