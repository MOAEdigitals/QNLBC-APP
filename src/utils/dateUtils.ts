/**
 * Date utility helpers for New Life Baptist Church Program App
 */

export function parseDate(dateStr: string): Date {
  // Parses YYYY-MM-DD safely into local date
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0); // Use noon to avoid timezone shift
}

export function formatDateStr(dateStr: string, options?: { showDayOfWeek?: boolean; shortMonth?: boolean }): string {
  if (!dateStr) return '';
  const d = parseDate(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const dayOfWeek = days[d.getDay()];
  const monthName = options?.shortMonth ? shortMonths[d.getMonth()] : months[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();

  if (options?.showDayOfWeek) {
    return `${dayOfWeek}, ${monthName} ${day}, ${year}`;
  }
  return `${monthName} ${day}, ${year}`;
}

export function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = parseDate(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${shortMonths[d.getMonth()]} ${d.getDate()}`;
}

export function getTodayStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getNextSundayStr(): string {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday
  const daysUntilSunday = (7 - dayOfWeek) % 7;
  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() + (daysUntilSunday === 0 ? 0 : daysUntilSunday));
  
  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isPastDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const today = getTodayStr();
  return dateStr < today;
}

export function isToday(dateStr: string): boolean {
  return dateStr === getTodayStr();
}

/**
 * Returns the start (Monday 00:00:00) and end (Sunday 23:59:59) of the current recognition window.
 * Current week window: last Monday through this Sunday.
 */
export function getCurrentRecognitionWindow(): {
  mondayDate: Date;
  sundayDate: Date;
  mondayStr: string;
  sundayStr: string;
} {
  const now = new Date();
  const day = now.getDay(); // 0 (Sun) to 6 (Sat)
  // Distance to current Monday:
  // If Sunday (0), Monday was 6 days ago
  // If Monday (1), Monday is today (0 days ago)
  // If Saturday (6), Monday was 5 days ago
  const diffToMonday = (day + 6) % 7;

  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const toYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dayOfMonth = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dayOfMonth}`;
  };

  return {
    mondayDate: monday,
    sundayDate: sunday,
    mondayStr: toYMD(monday),
    sundayStr: toYMD(sunday),
  };
}

/**
 * Check if a birthday or anniversary date falls in the current recognition window (Last Monday through this Sunday).
 * We compare the Month and Day within the current calendar year.
 */
export function isInCurrentRecognitionWindow(annualDateStr: string): boolean {
  if (!annualDateStr) return false;
  const { mondayDate, sundayDate } = getCurrentRecognitionWindow();
  const parsed = parseDate(annualDateStr);
  const currentYear = mondayDate.getFullYear();

  // Project the celebrant's birth month/day into this current year
  const projectedThisYear = new Date(currentYear, parsed.getMonth(), parsed.getDate(), 12, 0, 0);

  return projectedThisYear >= mondayDate && projectedThisYear <= sundayDate;
}

/**
 * Get next occurrence of an annual date (e.g. Birthday or Anniversary)
 */
export function getNextAnnualOccurrence(dateStr: string): Date {
  const parsed = parseDate(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const thisYear = now.getFullYear();

  const thisYearOccurrence = new Date(thisYear, parsed.getMonth(), parsed.getDate(), 12, 0, 0);
  if (thisYearOccurrence >= now) {
    return thisYearOccurrence;
  }
  return new Date(thisYear + 1, parsed.getMonth(), parsed.getDate(), 12, 0, 0);
}

/**
 * Sorts array of items by date:
 * 1. Future/today dates at top (ascending: soonest first)
 * 2. Past dates below (descending: most recent past first)
 */
export function sortUpcomingFirst<T>(items: T[], getDate: (item: T) => string): T[] {
  const today = getTodayStr();

  const upcoming = items
    .filter((item) => getDate(item) >= today)
    .sort((a, b) => getDate(a).localeCompare(getDate(b)));

  const past = items
    .filter((item) => getDate(item) < today)
    .sort((a, b) => getDate(b).localeCompare(getDate(a)));

  return [...upcoming, ...past];
}

/**
 * Sorts annual celebrants (Birthdays / Anniversaries):
 * Splits into:
 * 1. Current window celebrants (last Monday through this Sunday)
 * 2. Upcoming celebrants in chronological order (by days until next occurrence)
 */
export function categorizeAnnualCelebrants<T>(items: T[], getDateStr: (item: T) => string): {
  currentWindow: T[];
  upcoming: T[];
} {
  const currentWindow: T[] = [];
  const upcomingCandidates: { item: T; nextDate: Date }[] = [];

  for (const item of items) {
    const dateStr = getDateStr(item);
    if (!dateStr) continue;

    if (isInCurrentRecognitionWindow(dateStr)) {
      currentWindow.push(item);
    } else {
      const nextOccur = getNextAnnualOccurrence(dateStr);
      upcomingCandidates.push({ item, nextDate: nextOccur });
    }
  }

  // Sort current window by day of week (Monday first to Sunday)
  currentWindow.sort((a, b) => {
    const da = parseDate(getDateStr(a));
    const db = parseDate(getDateStr(b));
    return da.getMonth() === db.getMonth() ? da.getDate() - db.getDate() : da.getMonth() - db.getMonth();
  });

  // Sort upcoming chronologically
  upcomingCandidates.sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());

  return {
    currentWindow,
    upcoming: upcomingCandidates.map((c) => c.item),
  };
}
