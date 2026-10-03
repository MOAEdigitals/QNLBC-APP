import React from 'react';
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
// Keep the list's first-seen month order and card order within each month.
export function monthList<T>(items: T[], dateOf: (item: T) => string | undefined, noun: [string, string], options: { annual?: boolean; hidden?: boolean } = {}) {
  return { render(renderItem: (item: T) => React.ReactNode): React.ReactNode[] {
    if (options.hidden) return items.map(renderItem);
    return groupByMonth(items, dateOf, options.annual).flatMap(group => [
      <div key={`month-${group.key}`} className="col-span-full flex items-center gap-3 px-1 pt-3 first:pt-0" role="heading" aria-level={3}>
        <span className="shrink-0 text-sm font-bold text-slate-700 dark:text-slate-200">{group.label}</span>
        <div aria-hidden="true" className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        <span className="shrink-0 text-xs font-semibold text-indigo-700 dark:text-indigo-300">{group.items.length} {noun[group.items.length === 1 ? 0 : 1]}</span>
      </div>, ...group.items.map(renderItem),
    ]);
  } };
}
