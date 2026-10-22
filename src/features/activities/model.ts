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
export function isPastActivity(activityDate: string, today: string): boolean {
  return activityDate < today;
}

export function sortActivities(items: ChurchActivity[]): ChurchActivity[] {
  return [...items].sort((a, b) => {
    const dateOrder = a.activityDate.localeCompare(b.activityDate);
    return dateOrder || (a.activityTime || '').localeCompare(b.activityTime || '');
  });
}

/** Upcoming dates ascend; past dates follow, most recent first. */
export function orderActivityList(items: ChurchActivity[], today: string): ChurchActivity[] {
  const sorted = sortActivities(items);
  return [
    ...sorted.filter(item => !isPastActivity(item.activityDate, today)),
    ...sorted.filter(item => isPastActivity(item.activityDate, today)).reverse(),
  ];
}

export function activityBadge(activityDate: string, today: string, isNext: boolean): string | null {
  if (isPastActivity(activityDate, today)) return null;
  if (activityDate === today) return 'Today';
  return isNext ? 'Next up' : 'Upcoming';
}
