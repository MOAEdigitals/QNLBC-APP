/** Keep one integer-pixel viewport for forms, including overlay and resizing IMEs. */
export function installFormViewport(win: Window = window, doc: Document = document, nav: Navigator = navigator) {
  const keyboard = (nav as Navigator & { virtualKeyboard?: EventTarget & { overlaysContent: boolean; boundingRect: DOMRect } }).virtualKeyboard;
  if (keyboard) keyboard.overlaysContent = true;
  let baseline = win.innerHeight, width = win.innerWidth, frame = 0;
  let previousHeight = -1, previousTop = -1;
  const update = () => {
    frame = 0;
    if (width !== win.innerWidth) { width = win.innerWidth; baseline = win.innerHeight; }
    baseline = Math.max(baseline, win.innerHeight);
    const viewport = win.visualViewport;
    const keyboardTop = keyboard?.boundingRect.height ? keyboard.boundingRect.y : win.innerHeight;
    const rawTop = viewport?.offsetTop ?? 0;
    const usableHeight = Math.min(viewport?.height ?? win.innerHeight, Math.max(0, keyboardTop - rawTop));
    const open = baseline - usableHeight > 120;
    // Focus can produce tiny visualViewport pans even before the keyboard opens.
    const top = open || (viewport?.scale ?? 1) > 1 ? Math.round(rawTop) : 0;
    const height = Math.round(Math.min(viewport?.height ?? win.innerHeight, Math.max(0, keyboardTop - top)));
    doc.documentElement.classList.toggle('keyboard-open', open);
    if (Math.abs(previousHeight - height) >= 2) {
      doc.documentElement.style.setProperty('--form-viewport-height', `${height}px`);
      previousHeight = height;
    }
    if (Math.abs(previousTop - top) >= 2 || previousTop < 0) {
      doc.documentElement.style.setProperty('--form-viewport-top', `${top}px`);
      previousTop = top;
    }
  };
  const schedule = () => { if (!frame) frame = win.requestAnimationFrame(update); };
  keyboard?.addEventListener('geometrychange', schedule);
  win.visualViewport?.addEventListener('resize', schedule);
  win.visualViewport?.addEventListener('scroll', schedule);
  win.addEventListener('resize', schedule);
  update();
  return () => {
    if (frame) win.cancelAnimationFrame(frame);
    keyboard?.removeEventListener('geometrychange', schedule);
    win.visualViewport?.removeEventListener('resize', schedule);
    win.visualViewport?.removeEventListener('scroll', schedule);
    win.removeEventListener('resize', schedule);
  };
}
