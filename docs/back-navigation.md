# Back navigation and exit

`useAppExitGuard` owns the app boundary. `useBackLayer` registers internal screens,
search, pickers and dialogs so they receive Back before root navigation.

Schedules (`special-numbers`) remains the landing/root screen. `home` is the
existing internal route name for the Setlists tab, not the exit root.

1. Native keyboard and open action menus dismiss first.
2. The top registered screen/picker closes. Saving/discard guards can keep it open.
3. Back from a main tab returns to Schedules without an exit dialog.
4. Back at Schedules shows **Exit App?**. Back, Escape, Cancel or the backdrop
   cancel it. Only the Exit button requests an exit.

## Web

The guard creates a history boundary and re-arms it synchronously on Back. It also
re-arms once on a trusted interaction because browsers can skip history entries
created before user activation. `beforeunload` supplies the browser's generic
confirmation for page close/refresh or traversal that bypasses the SPA.

Browsers control Back-history skipping, tab closing and unload prompts. A page
cannot guarantee a custom dialog before every browser gesture, particularly
before the user has interacted with it. Mobile browsers may suppress unload
prompts entirely. A confirmed exit attempts to close the tab or leave the app's
history; if blocked, it displays **You can now close this tab.**

## Android

The existing `@capacitor/app` listener handles `backButton`. It dispatches to the
shared layer stack even if `canGoBack` is false. `App.exitApp()` runs only after
confirmation. The installed Capacitor App plugin uses AndroidX
`OnBackPressedCallback`; the manifest enables Android's Back invocation callback.
No additional plugin, package change or Capacitor configuration is required.

Android source changes require a newly built/installed APK. A web deployment does
not update bundled code in an existing APK. No APK was built for this change.

## Verification

- Open each main tab; Back should return to Schedules without a prompt.
- Open nested pickers/search/editor screens; Back should close the top one first.
- At Schedules, repeat Back/Cancel several times; at most one prompt may exist.
- Back or Escape on the prompt must cancel; only Exit may leave.
- Test both gesture and hardware Back on a physical Android device when a new APK
  is requested. Desktop/browser tests do not verify Android predictive gestures.
