import type { ChurchActivity } from '../../types';

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
