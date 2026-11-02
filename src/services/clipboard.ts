export interface CopyFeedback { id: number; state: 'copying' | 'copied' | 'error'; message: string }
let current: CopyFeedback | null = null;
let sequence = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
export const getCopyFeedback = () => current;
export const subscribeCopyFeedback = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function feedback(id: number, state: CopyFeedback['state'], message: string) {
  if (id !== sequence) return;
  if (timer) clearTimeout(timer);
  current = { id, state, message }; listeners.forEach(listener => listener());
  if (state !== 'copying') timer = setTimeout(() => { if (current?.id === id) { current = null; listeners.forEach(listener => listener()); } }, state === 'error' ? 4500 : 2000);
}

/** Synchronous fallback stays within the user's tap and restores focus/selection. */
function legacyCopy(text: string): void {
  const active = document.activeElement as HTMLElement | null;
  const input = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? active : null;
  const caret = input ? [input.selectionStart, input.selectionEnd] : null;
  const selection = window.getSelection();
  const ranges = selection ? Array.from({length:selection.rangeCount},(_,index)=>selection.getRangeAt(index).cloneRange()) : [];
  const x=window.scrollX, y=window.scrollY;
  const field = document.createElement('textarea');
  field.value = text; field.readOnly = true; field.tabIndex = -1;
  field.setAttribute('aria-label','Copy text');
  Object.assign(field.style,{position:'fixed',top:'0',left:'0',width:'1px',height:'1px',opacity:'0',fontSize:'16px'});
  try {
    document.body.appendChild(field); field.focus({preventScroll:true}); field.select(); field.setSelectionRange(0,text.length);
    if (!document.execCommand?.('copy')) throw new Error('Clipboard copy was blocked.');
  } finally {
    field.remove();
    active?.focus({preventScroll:true});
    if (input && caret && caret[0] !== null && caret[1] !== null) { try { input.setSelectionRange(caret[0],caret[1]); } catch {} }
    else if (selection) { selection.removeAllRanges(); ranges.forEach(range=>selection.addRange(range)); }
    if (window.scrollX!==x || window.scrollY!==y) window.scrollTo(x,y);
  }
}

/** Invoke the clipboard immediately: no network, permission preflight or delay. */
export async function copyText(text: string, html?: string): Promise<void> {
  if (!text) throw new Error('Nothing to copy.');
  if (html && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try { await navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([text],{type:'text/plain'}),'text/html':new Blob([html],{type:'text/html'})})]); return; } catch { /* Retry as plain text when rich copying is unsupported. */ }
  }
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(text); return; } catch { /* Older WebViews can still support the synchronous fallback. */ }
  }
  legacyCopy(text);
}

/** Success is shown only after a confirmed write; all failures stay visible. */
export async function copyWithFeedback(text: string, message = 'Copied.', html?: string): Promise<boolean> {
  const id = ++sequence;
  feedback(id,'copying','Copying…');
  try { await copyText(text,html); feedback(id,'copied',message); return true; }
  catch { feedback(id,'error',text ? 'Unable to copy. Please tap Copy again.' : 'Nothing to copy.'); return false; }
}
