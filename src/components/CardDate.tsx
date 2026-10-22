import React from 'react';
import { parseDate } from '../utils/dateUtils';

/** Shared plain date and divider, matching the Activities card layout. */
export function CardDate({ date }: { date: string }) {
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date);
  return <>
    <div className="app-card-date flex min-h-11 w-10 shrink-0 flex-col items-center justify-center" aria-label={valid ? date : 'No date'}>
      <span className="app-card-day">{valid ? Number(date.slice(8)) : '—'}</span>
      {valid && <span className="app-card-weekday">{parseDate(date).toLocaleDateString('en-US', { weekday: 'short' })}</span>}
    </div>
    <div aria-hidden="true" className="h-10 w-px shrink-0 bg-slate-300 dark:bg-slate-700" />
  </>;
}
