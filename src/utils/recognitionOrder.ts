/** Current month first, future months ascending, previous months most recent first. */
export function compareMonthKeys(a: string, b: string, current: string): number {
  if (a === b) return 0;
  if (a === current) return -1;
  if (b === current) return 1;
  const aPast = a < current, bPast = b < current;
  if (aPast !== bPast) return aPast ? 1 : -1;
  return aPast ? b.localeCompare(a) : a.localeCompare(b);
}

export function isAnnualDatePast(date: string, today: string): boolean {
  return date.slice(5) < today.slice(5);
}

export function orderAnnualBirthdays<T>(items: T[], dateOf: (item: T) => string, today: string): T[] {
  const year = today.slice(0, 4), month = today.slice(0, 7);
  return [...items].sort((a, b) => {
    const aDate = `${year}-${dateOf(a).slice(5)}`, bDate = `${year}-${dateOf(b).slice(5)}`;
    const monthOrder = compareMonthKeys(aDate.slice(0, 7), bDate.slice(0, 7), month);
    if (monthOrder) return monthOrder;
    const aPast = aDate < today, bPast = bDate < today;
    if (aPast !== bPast) return aPast ? 1 : -1;
    return aPast ? bDate.localeCompare(aDate) : aDate.localeCompare(bDate);
  });
}
