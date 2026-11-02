import type { AnniversaryCelebrant } from '../types.ts';

/** Full dates stay one-time; the Sunday recognition week is Thursday–Wednesday. */
export function recognitionWindow(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() + (7 - start.getDay()) % 7 - 3);
  const end = new Date(start); end.setDate(start.getDate() + 7);
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return { start: ymd(start), end: ymd(end) };
}
export function isSpecialRecognitionWeek(date: string, now = new Date()) {
  const {start,end}=recognitionWindow(now);
  return date >= start && date < end;
}
export function partitionSpecialRecognitions<T>(items: T[], dateOf: (item:T)=>string, now=new Date()) {
  const {start}=recognitionWindow(now);
  return {
    upcoming: items.filter(item=>dateOf(item)>=start).sort((a,b)=>dateOf(a).localeCompare(dateOf(b))),
    past: items.filter(item=>dateOf(item)<start).sort((a,b)=>dateOf(b).localeCompare(dateOf(a))),
  };
}
/** Existing yearsCount is the count at the stored date, including legacy records. */
export function anniversaryStartingYear(item: AnniversaryCelebrant): number | undefined {
  const count=item.yearsCount ?? item.years_count;
  return count == null ? undefined : Number(item.anniversaryDate.slice(0,4))-count;
}
export function anniversaryYears(item: AnniversaryCelebrant, year: number): number | undefined {
  const start=anniversaryStartingYear(item);
  return start == null ? undefined : Math.max(0,year-start);
}
/** Use the correct year for a recognition week spanning New Year. */
export function annualRecognitionYear(date: string, now = new Date()): number {
  const {start,end}=recognitionWindow(now);
  for (const year of new Set([Number(start.slice(0,4)),Number(end.slice(0,4))])) {
    const occurrence=`${year}-${date.slice(5)}`;
    if (occurrence>=start && occurrence<end) return year;
  }
  return now.getFullYear();
}
