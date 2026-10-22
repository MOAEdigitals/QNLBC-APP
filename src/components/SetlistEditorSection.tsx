import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function SetlistEditorSection({ title, summary, colorClass, initialOpen = false, children }: {
  title: string; summary?: string; colorClass: string; initialOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(initialOpen);
  const id = useId();
  return <section className="border-t border-slate-200 dark:border-slate-700">
    <h4>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}
        className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left cursor-pointer">
        <span className="min-w-0">
          <span className={`block text-base font-bold ${colorClass}`}>{title}</span>
          {summary && <span className="mt-1 block break-words text-xs font-normal text-slate-500 dark:text-slate-400">{summary}</span>}
        </span>
        <ChevronDown aria-hidden="true" className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
    </h4>
    <div id={id} hidden={!open} className="space-y-3.5 pb-4" onInvalidCapture={event => {
      if (open) return;
      event.preventDefault();
      const field = event.target as HTMLInputElement;
      setOpen(true);
      requestAnimationFrame(() => { field.focus(); field.reportValidity(); });
    }}>{children}</div>
  </section>;
}
