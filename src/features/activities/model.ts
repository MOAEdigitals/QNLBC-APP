import { serviceCompleted } from '../../utils/serviceCompletion.ts';
import type { ChurchActivity } from '../../types';

export type ActivityKind = 'prayer' | 'sunday' | 'practice' | 'other';
export function activityKind(title: string): ActivityKind {
  if (/(?:prayer\s*meeting|midweek\s*prayer)/i.test(title)) return 'prayer';
  if (/sunday\s*service/i.test(title)) return 'sunday';
  if (/(?:song\s*leaders?|choir).*practice|practice.*(?:song\s*leaders?|choir)|saturday.*practice/i.test(title)) return 'practice';
  return 'other';
}

/** Routine weekly gatherings keep the neutral card treatment. */
export function isRoutineActivity(title: string): boolean {
  return activityKind(title) !== 'other';
}

/** Activities are dated occurrences, not annually recurring events. */
export function isPastActivity(activityDate: string, today: string, title = '', now?: number): boolean {
  return activityDate < today || (now !== undefined && activityDate === today && serviceCompleted(activityDate, title, now));
}

function sundayServiceOrder(a: ChurchActivity, b: ChurchActivity): number {
  if (new Date(a.activityDate + 'T12:00:00+08:00').getUTCDay() !== 0) return 0;
  return Number(activityKind(b.title) === 'sunday') - Number(activityKind(a.title) === 'sunday');
}

export function sortActivities(items: ChurchActivity[]): ChurchActivity[] {
  return [...items].sort((a, b) => {
    const dateOrder = a.activityDate.localeCompare(b.activityDate);
    return dateOrder || sundayServiceOrder(a, b) || (a.activityTime || '').localeCompare(b.activityTime || '');
  });
}

/** Keep each year's upcoming dates first, followed by that year's completed dates. */
export function orderActivityList(items: ChurchActivity[], today: string, now?: number): ChurchActivity[] {
  const years = new Map<string, ChurchActivity[]>();
  for (const item of sortActivities(items)) {
    const year = item.activityDate.slice(0, 4);
    if (!years.has(year)) years.set(year, []);
    years.get(year)!.push(item);
  }
  return [...years].sort(([aYear, a], [bYear, b]) => {
    const aUpcoming = a.some(item => !isPastActivity(item.activityDate, today, item.title, now));
    const bUpcoming = b.some(item => !isPastActivity(item.activityDate, today, item.title, now));
    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
    return aUpcoming ? aYear.localeCompare(bYear) : bYear.localeCompare(aYear);
  }).flatMap(([, entries]) => [
    ...entries.filter(item => !isPastActivity(item.activityDate, today, item.title, now)),
    ...entries.filter(item => isPastActivity(item.activityDate, today, item.title, now)).reverse().sort((a, b) => b.activityDate.localeCompare(a.activityDate) || sundayServiceOrder(a, b)),
  ]);
}

/** Month headings must not merge completed cards back into an upcoming month. */
export function groupActivityMonths(items: ChurchActivity[], today: string, now?: number): { key: string; label: string; items: ChurchActivity[] }[] {
  const groups: { key: string; label: string; items: ChurchActivity[] }[] = [];
  for (const item of orderActivityList(items, today, now)) {
    const month = item.activityDate.slice(0, 7);
    const key = `${month}-${isPastActivity(item.activityDate, today, item.title, now) ? 'past' : 'upcoming'}`;
    if (groups.at(-1)?.key !== key) {
      const label = new Date(Number(month.slice(0, 4)), Number(month.slice(5)) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      groups.push({ key, label, items: [] });
    }
    groups.at(-1)!.items.push(item);
  }
  return groups;
}

export function activityBadge(activityDate: string, today: string, isNext: boolean): string | null {
  if (isPastActivity(activityDate, today)) return null;
  if (activityDate === today) return 'Today';
  return isNext ? 'Next up' : 'Upcoming';
}
