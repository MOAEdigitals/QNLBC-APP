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

/** Keep months together in annual order, starting with birthdays still to recognize. */
export function orderBirthdayRecognitionMonths<T>(items: T[], dateOf: (item: T) => string, today: string): T[] {
  const [year, month, day] = today.split('-').map(Number);
  const start = new Date(year, month - 1, day);
  start.setDate(start.getDate() + (7 - start.getDay()) % 7 - 3);
  const startMonthDay = (start.getMonth() + 1) * 100 + start.getDate();
  const monthRanks = new Map<number, number>();
  const entries = items.map(item => {
    const [, birthMonth, birthDay] = dateOf(item).split('-').map(Number);
    const monthDay = birthMonth * 100 + birthDay;
    // Sort the annual calendar without turning February 29 into March 1.
    const rank = (start.getFullYear() + (monthDay < startMonthDay ? 1 : 0)) * 10000 + monthDay;
    monthRanks.set(birthMonth, Math.min(monthRanks.get(birthMonth) ?? Infinity, rank));
    return { item, month: birthMonth, rank };
  });
  return entries.sort((a, b) =>
    (monthRanks.get(a.month)! - monthRanks.get(b.month)!) || a.rank - b.rank,
  ).map(entry => entry.item);
}
