import type { AnniversaryCelebrant } from '../types.ts';

/** Birthday and anniversary recognition week: Thursday–Wednesday. */
export function recognitionWindow(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() + (7 - start.getDay()) % 7 - 3);
  const end = new Date(start); end.setDate(start.getDate() + 7);
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return { start: ymd(start), end: ymd(end) };
}
/** Exclusive end: Monday after the second Sunday on or after the event date. */
export function specialRecognitionEnd(date: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [year,month,day]=date.split('-').map(Number);
  const end=new Date(year,month-1,day);
  if (end.getFullYear()!==year || end.getMonth()!==month-1 || end.getDate()!==day) return null;
  end.setDate(end.getDate() + (7-end.getDay())%7 + 8);
  return `${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`;
}
function localDay(now: Date) {
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
export function isSpecialRecognitionActive(date: string, now = new Date()): boolean {
  const end=specialRecognitionEnd(date), today=localDay(now);
  return end !== null && date <= today && today < end;
}
export function partitionSpecialRecognitions<T>(items: T[], dateOf: (item:T)=>string, now=new Date()) {
  const today=localDay(now);
  const pending=(item:T) => { const end=specialRecognitionEnd(dateOf(item)); return end !== null && end > today; };
  return {
    upcoming: items.filter(pending).sort((a,b)=>dateOf(a).localeCompare(dateOf(b))),
    past: items.filter(item=>!pending(item)).sort((a,b)=>dateOf(b).localeCompare(dateOf(a))),
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
