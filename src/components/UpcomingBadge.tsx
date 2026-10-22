import React from 'react';
import type { UpcomingCardStatus } from '../utils/upcomingCards';

export function UpcomingBadge({ status }: { status?: UpcomingCardStatus | 'today' }) {
  if (!status) return null;
  return <span data-card-status={status} className={`app-status-badge shrink-0 rounded px-1.5 py-0.5 text-[10px] whitespace-nowrap ${status === 'upcoming'
    ? 'font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
    : 'font-bold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'}`}>
    {status === 'today' ? 'Today' : status === 'next-up' ? 'Next up' : 'Upcoming'}
  </span>;
}
