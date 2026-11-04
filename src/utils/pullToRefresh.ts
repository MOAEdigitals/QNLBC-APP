const blockedLayers = '.ui-form-screen, .ui-viewport-screen, .ui-picker-viewport, .ui-bottom-sheet-backdrop, [role="dialog"], [aria-modal="true"], [role="menu"], details[open]';

/** A downward pull starts at the top; reaching the top mid-gesture never refreshes. */
export function installPullToRefresh(options: {
  enabled: () => boolean;
  blocked: () => boolean;
  refresh: () => Promise<unknown>;
  progress: (distance: number, refreshing: boolean) => void;
}, win: Window = window, doc: Document = document) {
  let gesture: { id: number; x: number; y: number; distance: number } | null = null;
  let busy = false, alive = true;
  const unavailable = () => !options.enabled() || options.blocked()
    || doc.documentElement.classList.contains('keyboard-open') || Boolean(doc.querySelector(blockedLayers));
  const reset = () => { gesture = null; if (!busy) options.progress(0, false); };
  const start = (event: TouchEvent) => {
    reset();
    if (busy || unavailable() || event.touches.length !== 1 || win.scrollY > 1 || doc.documentElement.scrollTop > 1) return;
    const target = event.target as Element | null;
    if (!target?.closest?.('.qnlbc-app') || target.closest('input,textarea,select,a,form,[contenteditable="true"],audio,video,[data-no-swipe],.app-bottom-nav,.app-fab,[aria-label^="Reorder"],[aria-label^="Move song"]')) return;
    if (win.getSelection()?.toString()) return;
    // Leave nested lists and horizontal carousels in charge of their gestures.
    for (let node = target; node && !node.classList.contains('qnlbc-app'); node = node.parentElement) {
      const style = win.getComputedStyle(node);
      if ((node.scrollHeight > node.clientHeight + 1 && /auto|scroll/.test(style.overflowY))
        || (node.scrollWidth > node.clientWidth + 1 && /auto|scroll/.test(style.overflowX))) return;
    }
    const touch = event.touches[0];
    if (touch.clientX <= 24 || touch.clientX >= win.innerWidth - 24) return;
    gesture = { id: touch.identifier, x: touch.clientX, y: touch.clientY, distance: 0 };
  };
  const move = (event: TouchEvent) => {
    if (!gesture) return;
    if (unavailable() || event.touches.length !== 1) { reset(); return; }
    const touch = event.touches[0];
    const dy = touch.clientY - gesture.y, dx = Math.abs(touch.clientX - gesture.x);
    if (touch.identifier !== gesture.id || dy < -8 || (dx > 12 && dx > Math.abs(dy))) { reset(); return; }
    if (dy < 10 || dy < dx * 1.4) return;
    // Own this pull instead of the browser's full-page reload gesture.
    if (event.cancelable) event.preventDefault();
    gesture.distance = Math.min(100, dy * .5);
    options.progress(gesture.distance, false);
  };
  const end = () => {
    const distance = gesture?.distance ?? 0;
    gesture = null;
    if (distance < 64 || unavailable() || busy) { reset(); return; }
    busy = true; options.progress(64, true);
    void Promise.resolve().then(options.refresh).catch(() => {}).finally(() => {
      busy = false;
      if (alive) options.progress(0, false);
    });
  };
  doc.addEventListener('touchstart', start, { passive: true });
  doc.addEventListener('touchmove', move, { passive: false });
  doc.addEventListener('touchend', end);
  doc.addEventListener('touchcancel', reset);
  return () => {
    alive = false; doc.removeEventListener('touchstart', start); doc.removeEventListener('touchmove', move);
    doc.removeEventListener('touchend', end); doc.removeEventListener('touchcancel', reset);
  };
}
