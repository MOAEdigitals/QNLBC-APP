export type UpcomingCardStatus = 'next-up' | 'upcoming';

/** Rank the first two future entries from the full list, independently of search. */
export function upcomingCardStatuses<T extends { id: string }>(
  items: T[], dateOf: (item: T) => string | undefined, today: string,
  eligible: (item: T) => boolean = () => true,
): Map<string, UpcomingCardStatus> {
  const candidates = items.filter(item => {
    const date = dateOf(item);
    return !!date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date > today && eligible(item);
  }).sort((a, b) => dateOf(a)!.localeCompare(dateOf(b)!));
  return new Map(candidates.slice(0, 2).map((item, index) => [item.id, index === 0 ? 'next-up' : 'upcoming']));
}
