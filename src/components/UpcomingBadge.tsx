import React from 'react';
import type { UpcomingCardStatus } from '../utils/upcomingCards';

export function UpcomingBadge({ status }: { status?: UpcomingCardStatus }) {
  if (!status) return null;
  return <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${status === 'next-up'
    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
    : 'border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'}`}>
    {status === 'next-up' ? 'Next up' : 'Upcoming'}
  </span>;
}
