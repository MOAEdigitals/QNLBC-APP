import React, { useSyncExternalStore } from 'react';
import { getCopyFeedback, subscribeCopyFeedback } from '../services/clipboard';
import { LoadingIcon, SuccessIcon } from './AnimatedIcons';
export function CopyFeedbackToast() {
  const feedback=useSyncExternalStore(subscribeCopyFeedback,getCopyFeedback,()=>null);
  if (!feedback) return null;
  return <div className="pointer-events-none fixed inset-x-4 z-[10000] flex justify-center" style={{bottom:'max(calc(var(--app-bottom-nav-height, 4.25rem) + var(--app-safe-bottom, 0px) + 12px), calc(100dvh - var(--form-viewport-height, 100dvh) - var(--form-viewport-top, 0px) + 12px))'}}>
    <div role="status" aria-live="polite" aria-atomic="true" className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg ${feedback.state === 'error' ? 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-100' : 'border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white'}`}>{feedback.state === 'copied' ? <SuccessIcon key={feedback.id} className="h-4 w-4 text-emerald-500" /> : feedback.state === 'copying' ? <LoadingIcon className="h-4 w-4" /> : null}{feedback.message}</div>
  </div>;
}
