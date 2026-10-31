import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';

function dismissOpenActions() {
  const menu = document.querySelector('details.ui-actions[open], [data-song-actions] button[aria-expanded="true"], [data-attachment-actions] button[aria-expanded="true"], [data-setlist-actions] button[aria-expanded="true"], [data-birthday-actions] button[aria-expanded="true"], [data-activity-actions] button[aria-expanded="true"], button[aria-label="Track options"][aria-expanded="true"]');
  if (!menu) return false;
  menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return true;
}

/** Own the final Back boundary for every screen, including authentication/loading. */
export function useAppExitGuard(tab: string) {
  const [isOpen, setOpen] = useState(false);
  const [exiting, setExiting] = useState(false);
  const latest = useRef({ tab, open: false, exiting: false });
  latest.current.tab = tab;
  const initialized = useRef(false);
  const pendingBack = useRef(false);
  const cancel = useCallback(() => { latest.current.open = false; setOpen(false); }, []);
  const ask = useCallback(() => { latest.current.open = true; setOpen(true); }, []);
  useLayoutEffect(() => {
    // Layout initialization precedes child screens adding their passive Back layers.
    if (!initialized.current) {
      initialized.current = true;
      window.history.replaceState({ appRoot: true }, '', window.location.href);
      window.history.pushState({ tab: latest.current.tab }, '', `#${latest.current.tab}`);
    }
    const onPop = (event: PopStateEvent) => {
      pendingBack.current = false;
      if (latest.current.exiting) return;
      const boundary = event.state?.appRoot || (!event.state?.tab && !event.state?.localScreen);
      if (!boundary && !latest.current.open) return;
      event.stopImmediatePropagation();
      // Re-arm before displaying the dialog: repeated Back cannot bypass the guard.
      window.history.pushState({ tab: latest.current.tab }, '', `#${latest.current.tab}`);
      if (latest.current.open) cancel(); else if (!dismissOpenActions()) ask();
    };
    window.addEventListener('popstate', onPop, true);
    return () => window.removeEventListener('popstate', onPop, true);
  }, [ask, cancel]);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false;
    const listener = NativeApp.addListener('backButton', event => {
      if (disposed || latest.current.exiting) return;
      if (latest.current.open) { cancel(); return; }
      // Android normally consumes Back for the IME first; cover overlay keyboards too.
      const focused = document.activeElement as HTMLElement | null;
      if (document.documentElement.classList.contains('keyboard-open') && focused?.matches('input,textarea,[contenteditable="true"]')) { focused.blur(); return; }
      if (dismissOpenActions()) return;
      if (!event.canGoBack) { ask(); return; }
      if (pendingBack.current) return;
      pendingBack.current = true;
      window.history.back();
    });
    return () => { disposed = true; void listener.then(handle => handle.remove()); };
  }, [ask, cancel]);
  const confirmExit = useCallback(async () => {
    if (!latest.current.open || latest.current.exiting) return;
    latest.current.exiting = true; setExiting(true);
    try {
      if (Capacitor.isNativePlatform()) await NativeApp.exitApp();
      else window.location.replace('about:blank');
    } catch {
      latest.current.exiting = false; setExiting(false);
    }
  }, []);
  return { isOpen, exiting, cancel, confirmExit };
}
