/** Protect actual edited forms on tab close/refresh, never ordinary browsing/search. */
export function installUnsavedFormWarning(win: Window, doc: Document, suppress: () => boolean) {
  const baselines = new Map<HTMLFormElement, string>();
  const eligible = (form: HTMLFormElement) => form.isConnected && !form.closest('[hidden], [aria-hidden="true"], .auth-screen') && !!form.querySelector('input:not([type="search"]), textarea, [contenteditable="true"]');
  const snapshot = (form: HTMLFormElement) => JSON.stringify([...form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLElement>('input, textarea, [contenteditable="true"]')].flatMap((field, index) => {
    if (field.matches('input[type="search"], input[type="submit"], input[type="button"], input[type="reset"]')) return [];
    const key = field.getAttribute('name') || field.id || String(index);
    if (field.matches('[contenteditable="true"]')) return field.innerHTML ? [[key, field.innerHTML]] : [];
    const input = field as HTMLInputElement;
    if (input.type === 'checkbox' || input.type === 'radio') return input.checked ? [[key, input.value || 'checked']] : [];
    if (input.type === 'file') return [...(input.files || [])].map(file => [key, file.name, file.size, file.lastModified]);
    return input.value ? [[key, input.value]] : [];
  }));
  const scan = () => {
    for (const form of baselines.keys()) if (!eligible(form)) baselines.delete(form);
    for (const form of doc.querySelectorAll<HTMLFormElement>('form')) if (eligible(form) && !baselines.has(form)) baselines.set(form, snapshot(form));
  };
  scan();
  const observer = new (win as Window & typeof globalThis).MutationObserver(scan);
  observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-hidden'] });
  const beforeInput = () => scan();
  doc.addEventListener('beforeinput', beforeInput, true);
  doc.addEventListener('focusin', beforeInput, true);
  const reset = (event: Event) => {
    const form = event.target as HTMLFormElement;
    win.queueMicrotask(() => { if (!event.defaultPrevented && eligible(form)) baselines.set(form, snapshot(form)); });
  };
  doc.addEventListener('reset', reset, true);
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (suppress()) return;
    if (![...baselines].some(([form, original]) => eligible(form) && (form.getAttribute('aria-busy') === 'true' || snapshot(form) !== original))) return;
    event.preventDefault(); event.returnValue = '';
  };
  win.addEventListener('beforeunload', beforeUnload);
  return () => {
    observer.disconnect(); baselines.clear();
    doc.removeEventListener('beforeinput', beforeInput, true); doc.removeEventListener('focusin', beforeInput, true); doc.removeEventListener('reset', reset, true);
    win.removeEventListener('beforeunload', beforeUnload);
  };
}
