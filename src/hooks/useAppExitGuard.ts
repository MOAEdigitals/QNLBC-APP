import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { dismissTopBackLayer, hasActiveBackLayer, isBackLayerTransitioning } from './useBackLayer';
import { installUnsavedFormWarning } from '../utils/unsavedForms';

// Schedules is the landing/root screen; the route named "home" is Setlists.
export const EXIT_HOME_TAB = 'special-numbers';
function dismissOpenActions() {
  const menu = document.querySelector('details.ui-actions[open], [data-song-actions] button[aria-expanded="true"], [data-attachment-actions] button[aria-expanded="true"], [data-setlist-actions] button[aria-expanded="true"], [data-birthday-actions] button[aria-expanded="true"], [data-activity-actions] button[aria-expanded="true"], button[aria-label="Track options"][aria-expanded="true"]');
  if (!menu) return false;
  menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return true;
}

/** Central exit boundary, sharing the screen/picker stack with useBackLayer. */
export function useAppExitGuard(tab: string, onHome: () => void) {
  const [isOpen, setOpen] = useState(false), [exiting, setExiting] = useState(false), [exitMessage, setExitMessage] = useState('');
  const latest = useRef({ tab, onHome, open: false, exiting: false });
  latest.current.tab = tab; latest.current.onHome = onHome;
  const initialized = useRef(false), entryIndex = useRef(0);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = useCallback(() => {
    latest.current.open = false; latest.current.exiting = false;
    setOpen(false); setExiting(false); setExitMessage('');
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
  }, []);
  const ask = useCallback(() => { latest.current.open = true; setExitMessage(''); setOpen(true); }, []);
  const goHome = useCallback(() => {
    latest.current.tab = EXIT_HOME_TAB;
    window.history.replaceState({ tab: EXIT_HOME_TAB }, '', `#${EXIT_HOME_TAB}`);
    latest.current.onHome();
  }, []);
  useLayoutEffect(() => {
    const arm = () => window.history.pushState({ tab: latest.current.tab }, '', `#${latest.current.tab}`);
    if (!initialized.current) {
      initialized.current = true; entryIndex.current = window.history.length - 1;
      window.history.replaceState({ appRoot: true }, '', window.location.href); arm();
    }
    const onPop = (event: PopStateEvent) => {
      if (latest.current.exiting) return;
      const boundary = event.state?.appRoot || (!event.state?.tab && !event.state?.localScreen);
      if (!latest.current.open && !boundary && (isBackLayerTransitioning() || hasActiveBackLayer())) return;
      event.stopImmediatePropagation();
      // Re-arm before another Back can traverse the final entry.
      arm();
      if (latest.current.open) { cancel(); return; }
      if (dismissTopBackLayer(true) || dismissOpenActions()) return;
      if (latest.current.tab !== EXIT_HOME_TAB) { goHome(); return; }
      ask();
    };
    window.addEventListener('popstate', onPop, true);
    // Chromium can skip entries created without user activation. Re-arm once
    // from a trusted interaction, without replacing an open screen layer.
    let activated = false;
    const activate = (event: Event) => {
      if (activated || !event.isTrusted || hasActiveBackLayer() || isBackLayerTransitioning() || latest.current.open) return;
      activated = true; window.history.replaceState({ appRoot: true }, '', window.location.href); arm();
    };
    window.addEventListener('pointerdown', activate, true);
    window.addEventListener('keydown', activate, true);
    const stopUnsavedWarning = !Capacitor.isNativePlatform()
      ? installUnsavedFormWarning(window, document, () => latest.current.exiting)
      : () => {};
    return () => {
      window.removeEventListener('popstate', onPop, true);
      window.removeEventListener('pointerdown', activate, true);
      window.removeEventListener('keydown', activate, true);
      stopUnsavedWarning();
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    };
  }, [ask, cancel, goHome]);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false;
    const listener = NativeApp.addListener('backButton', event => {
      if (disposed || latest.current.exiting) return;
      if (latest.current.open) { cancel(); return; }
      const focused = document.activeElement as HTMLElement | null;
      if (document.documentElement.classList.contains('keyboard-open') && focused?.matches('input,textarea,[contenteditable="true"]')) { focused.blur(); return; }
      if (isBackLayerTransitioning() || dismissOpenActions()) return;
      if (hasActiveBackLayer()) {
        // The top modal gets Back even when WebView reports no history.
        dismissTopBackLayer(!event.canGoBack);
        if (!event.canGoBack) window.history.replaceState({ tab: latest.current.tab }, '');
        return;
      }
      if (latest.current.tab !== EXIT_HOME_TAB) { goHome(); return; }
      ask();
    });
    return () => { disposed = true; void listener.then(handle => handle.remove()).catch(() => {}); };
  }, [ask, cancel, goHome]);
  const confirmExit = useCallback(async () => {
    if (!latest.current.open || latest.current.exiting) return;
    latest.current.exiting = true; setExiting(true);
    try {
      if (Capacitor.isNativePlatform()) { await NativeApp.exitApp(); return; }
      window.close();
      if (window.closed) return;
      if (entryIndex.current > 0) window.history.go(-(window.history.length - entryIndex.current));
      fallbackTimer.current = setTimeout(() => {
        latest.current.exiting = false; setExiting(false); setExitMessage('You can now close this tab.');
      }, 350);
    } catch {
      latest.current.exiting = false; setExiting(false); setExitMessage('Unable to close automatically. You can now close this tab.');
    }
  }, []);
  return { isOpen, exiting, exitMessage, cancel, confirmExit };
}
