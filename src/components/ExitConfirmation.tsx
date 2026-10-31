import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, LogOut, X } from 'lucide-react';

export function ExitConfirmation({ open, busy, onCancel, onExit }: { open: boolean; busy: boolean; onCancel: () => void; onExit: () => void }) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    cancel.current?.focus();
    return () => { if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [open]);
  if (!open) return null;
  return createPortal(<div role="alertdialog" aria-modal="true" aria-labelledby="exit-app-title" aria-describedby="exit-app-description" data-no-swipe className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget && !busy) onCancel(); }} onKeyDown={e => {
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); if (!busy) onCancel(); }
    if (e.key === 'Tab') {
      const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      const first = buttons[0], last = buttons.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  }}>
    <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
      <div className="flex items-center justify-between"><h3 id="exit-app-title" className="flex items-center gap-2 text-base font-bold"><AlertTriangle className="w-5 h-5 text-rose-600" />Exit app?</h3><button type="button" aria-label="Cancel exit" disabled={busy} onClick={onCancel} className="grid place-items-center h-11 w-11 text-slate-400"><X className="w-5 h-5" /></button></div>
      <p id="exit-app-description" className="text-sm text-slate-600 dark:text-slate-400">Exit the app? Your account will stay signed in.</p>
      <div className="flex justify-end gap-3"><button ref={cancel} type="button" disabled={busy} className="ui-secondary" onClick={onCancel}>Cancel</button><button type="button" disabled={busy} className="min-h-11 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white flex items-center gap-2" onClick={onExit}><LogOut className="h-4 w-4" />{busy ? 'Exiting…' : 'Exit app'}</button></div>
    </div>
  </div>, document.body);
}
