import React, { useEffect, useRef } from 'react';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';

export function CardActions({ label, onEdit, onDelete, disabled = false }: {
  label: string; onEdit?: () => void; onDelete?: () => void; disabled?: boolean;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) menu.current?.removeAttribute('open');
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menu.current?.open) {
        event.stopPropagation(); menu.current.removeAttribute('open');
        menu.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, []);
  if (!onEdit && !onDelete) return null;
  const run = (callback: () => void) => { menu.current?.removeAttribute('open'); callback(); };
  return <details ref={menu} className="ui-actions shrink-0" onClick={event => event.stopPropagation()}>
    <summary aria-label={`${label} actions`} title={`${label} actions`}><MoreVertical className="w-5 h-5" /></summary>
    <div className="ui-actions-menu">
      {onEdit && <button type="button" disabled={disabled} className="px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40" onClick={() => run(onEdit)}><Pencil className="w-4 h-4" />Edit</button>}
      {onDelete && <button type="button" disabled={disabled} className="px-3 py-2 rounded-lg text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 disabled:opacity-40" onClick={() => run(onDelete)}><Trash2 className="w-4 h-4" />Delete</button>}
    </div>
  </details>;
}
