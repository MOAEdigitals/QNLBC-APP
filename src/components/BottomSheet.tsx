import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useBackLayer } from '../hooks/useBackLayer';
const sheetStack: string[] = [];

export function BottomSheet({ open, title, children, onClose, onBack, role = 'dialog' }: {
  open: boolean; title: string; children: React.ReactNode; onClose: () => void;
  onBack?: () => void; role?: 'dialog' | 'alertdialog';
}) {
  const id = useId();
  const sheet = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; time: number } | null>(null);
  const closing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [offset, setOffset] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { onClose(); return; }
    setLeaving(true);
    timer.current = setTimeout(onClose, 180);
  };
  useBackLayer(open, () => { if (onBack) onBack(); else close(); });
  useEffect(() => {
    if (!open) return;
    closing.current = false; setLeaving(false); setOffset(0);
    sheetStack.push(id);
    const previous = document.activeElement as HTMLElement | null;
    (sheet.current?.querySelector<HTMLElement>('[data-sheet-focus]') || sheet.current?.querySelector<HTMLElement>('button:not(:disabled)'))?.focus({ preventScroll: true });
    const key = (event: KeyboardEvent) => {
      if (sheetStack.at(-1) !== id) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) && !(event.target as HTMLElement).matches('input, textarea, [contenteditable=true]')) {
        const options = Array.from(sheet.current?.querySelectorAll<HTMLButtonElement>('.ui-sheet-option:not(:disabled), [role="menuitemradio"]:not(:disabled)') || []);
        const current = options.indexOf(document.activeElement as HTMLButtonElement);
        if (options.length && (current >= 0 || ['ArrowDown', 'ArrowUp'].includes(event.key))) {
          event.preventDefault(); event.stopImmediatePropagation();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (current + (event.key === 'ArrowUp' ? -1 : 1) + options.length) % options.length;
          options[next]?.focus();
        }
      }
      if (event.key === 'Tab') {
        const controls = Array.from(sheet.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []).filter(el => !el.hidden && el.getAttribute('aria-hidden') !== 'true');
        const first = controls[0], last = controls.at(-1);
        if (!controls.includes(document.activeElement as HTMLElement)) { event.preventDefault(); first?.focus(); }
        else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', key, true);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null; closing.current = false;
      const index = sheetStack.indexOf(id); if (index >= 0) sheetStack.splice(index, 1);
      document.removeEventListener('keydown', key, true);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open]);
  if (!open) return null;
  return createPortal(<div className="ui-bottom-sheet-backdrop" data-leaving={leaving || undefined} data-no-swipe onPointerDown={event => { if (event.target === event.currentTarget) close(); }}>
    <div ref={sheet} role={role} aria-modal="true" aria-labelledby={id} className="ui-bottom-sheet" data-leaving={leaving || undefined} style={offset ? { transform: `translateY(${offset}px)` } : undefined}>
      <header className="ui-sheet-header" onPointerDown={event => {
        if (event.button !== 0 || (event.target as Element).closest('button')) return;
        drag.current = { y: event.clientY, time: event.timeStamp }; event.currentTarget.setPointerCapture?.(event.pointerId);
      }} onPointerMove={event => { if (drag.current) setOffset(Math.max(0, event.clientY - drag.current.y)); }} onPointerUp={event => {
        const start = drag.current; drag.current = null; if (!start) return;
        const distance = event.clientY - start.y;
        if (distance > 72 || (distance > 30 && distance / Math.max(1, event.timeStamp - start.time) > .55)) close();
        else setOffset(0);
      }} onPointerCancel={() => { drag.current = null; setOffset(0); }}>
        <div aria-hidden="true" className="ui-sheet-handle" />
        <div className="flex items-center justify-between gap-3"><h2 id={id} className="min-w-0 font-bold text-lg">{title}</h2><button type="button" aria-label={`Close ${title}`} onClick={close} className="ui-sheet-close"><X className="h-5 w-5" /></button></div>
      </header>
      <div className="ui-sheet-body">{children}</div>
    </div>
  </div>, document.body);
}
