import React from 'react';

export function splitPreviousYears<T>(items: T[], dateOf: (item: T) => string | undefined, currentYear = new Date().getFullYear()) {
  const current: T[] = [];
  const previous = new Map<number, T[]>();
  for (const item of items) {
    const date = dateOf(item) || '';
    const match = /^(\d{4})-\d{2}-\d{2}/.exec(date);
    const year = match ? Number(match[1]) : currentYear;
    if (year < currentYear) {
      if (!previous.has(year)) previous.set(year, []);
      previous.get(year)!.push(item);
    } else current.push(item);
  }
  return { current, previous: [...previous].sort(([a], [b]) => b - a) };
}

/** Presentation only: older years stay available, with matching search results revealed. */
export function yearList<T>(items: T[], dateOf: (item: T) => string | undefined, render: (items: T[]) => React.ReactNode[], options: { reveal?: boolean; revealYear?: string; currentYear?: number; gridClass?: string } = {}): React.ReactNode[] {
  const { current, previous } = splitPreviousYears(items, dateOf, options.currentYear);
  return [...render(current), ...previous.map(([year, entries]) =>
    <details key={`archive-${year}`} data-year-archive={year} open={options.reveal || options.revealYear === String(year) || undefined} className="col-span-full rounded-2xl border border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/30">
      <summary className="min-h-12 cursor-pointer rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{year}</summary>
      <div className={options.gridClass || 'grid grid-cols-1 gap-3 px-3 pb-3'}>{render(entries)}</div>
    </details>
  )];
}

export function groupByMonth<T>(items: T[], dateOf: (item: T) => string | undefined, annual = false) {
  const groups = new Map<string, { key: string; label: string; items: T[] }>();
  for (const item of items) {
    const date = dateOf(item) || '';
    const match = /^(\d{4})-(\d{2})-\d{2}/.exec(date);
    const month = match ? Number(match[2]) : 0;
    const valid = month >= 1 && month <= 12;
    const key = valid ? annual ? match![2] : `${match![1]}-${match![2]}` : 'undated';
    const label = valid ? new Date(2000, month - 1, 1).toLocaleDateString('en-US', { month: 'long' }) + (annual ? '' : ` ${match![1]}`) : 'No date';
    if (!groups.has(key)) groups.set(key, { key, label, items: [] });
    groups.get(key)!.items.push(item);
  }
  return [...groups.values()];
}

/** Completed records use month folders now; older months nest under their year. */
export function completedMonthList<T>(items: T[], dateOf: (item: T) => string | undefined, renderMonth: (items: T[], key: string) => React.ReactNode, options: { kind: string; reveal?: boolean; revealDate?: string; currentYear?: number } ) {
  const renderMonths = (entries: T[]) => groupByMonth([...entries].sort((a,b) => (dateOf(b) || '').localeCompare(dateOf(a) || '')), dateOf).map(group => (
    <details key={`completed-${group.key}`} data-completed-month={group.key} data-completed-kind={options.kind}
      data-completed-birthdays={options.kind === 'birthdays' || undefined}
      data-completed-song-numbers={options.kind === 'song-numbers' || undefined}
      data-completed-activities={options.kind === 'activities' || undefined}
      open={options.reveal || options.revealDate?.slice(0,7) === group.key || undefined}
      className="rounded-2xl border border-slate-200 dark:border-slate-800">
      <summary className="min-h-12 cursor-pointer px-4 py-3 text-sm font-semibold">{group.label.replace(/ \d{4}$/, '')}<span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">Completed</span></summary>
      <div className="space-y-3 px-3 pb-3">{renderMonth(group.items, group.key)}</div>
    </details>
  ));
  return yearList(items,dateOf,renderMonths,{reveal:options.reveal,revealYear:options.revealDate?.slice(0,4),currentYear:options.currentYear,gridClass:'space-y-3 px-3 pb-3'});
}
// Keep the list's first-seen month order and card order within each month.
export function monthList<T>(items: T[], dateOf: (item: T) => string | undefined, noun: [string, string], options: { annual?: boolean; hidden?: boolean; archive?: boolean; revealArchive?: boolean; revealDate?: string } = {}) {
  return { render(renderItem: (item: T) => React.ReactNode): React.ReactNode[] {
    if (options.hidden) return items.map(renderItem);
    const renderMonths = (entries: T[]) => groupByMonth(entries, dateOf, options.annual).flatMap(group => [
      <div key={`month-${group.key}`} className="col-span-full flex items-center gap-3 px-1 pt-3 first:pt-0" role="heading" aria-level={3}>
        <span className="shrink-0 text-sm font-bold text-slate-700 dark:text-slate-200">{group.label}</span>
        <div aria-hidden="true" className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
      </div>, ...group.items.map(renderItem),
    ]);
    return options.archive ? yearList(items, dateOf, renderMonths, { reveal: options.revealArchive, revealYear: options.revealDate?.slice(0, 4) }) : renderMonths(items);
  } };
}
