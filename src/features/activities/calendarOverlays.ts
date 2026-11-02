import type { BirthdayCelebrant } from '../../types';

export type CalendarOverlay = {
  id: string;
  date: string;
  title: string;
  kind: 'ph' | 'local' | 'birthday' | 'festival';
  detail: string;
  source?: string;
  sourceLabel?: string;
};
type HolidayRow = [monthDay: string, title: string, detail: string];
const proclamation2026 = 'https://lawphil.net/executive/proc/proc2025/pdf/proc_1006_2025.pdf';
const proclamation2027 = 'https://www.lawphil.net/executive/proc/proc2026/proc_1427_2026.html';
const common: HolidayRow[] = [
  ['01-01', "New Year's Day", 'Regular holiday'],
  ['02-25', 'EDSA People Power Revolution Anniversary', 'Special working day'],
  ['04-09', 'Araw ng Kagitingan', 'Regular holiday'],
  ['05-01', 'Labor Day', 'Regular holiday'],
  ['06-12', 'Independence Day', 'Regular holiday'],
  ['08-21', 'Ninoy Aquino Day', 'Special non-working day'],
  ['11-01', "All Saints' Day", 'Special non-working day'],
  ['11-02', "All Souls' Day", 'Special non-working day'],
  ['11-30', 'Bonifacio Day', 'Regular holiday'],
  ['12-08', 'Feast of the Immaculate Conception of Mary', 'Special non-working day'],
  ['12-24', 'Christmas Eve', 'Special non-working day'],
  ['12-25', 'Christmas Day', 'Regular holiday'],
  ['12-30', 'Rizal Day', 'Regular holiday'],
  ['12-31', 'Last Day of the Year', 'Special non-working day'],
];
function national(year: number, additional: HolidayRow[], source: string): CalendarOverlay[] {
  return [...common, ...additional].map(([day, title, detail]) => ({ id: `ph-${year}-${day}`, date: `${year}-${day}`, title, detail, kind: 'ph', source }));
}

/** Verified 2026-11-02. Only proclaimed dates; annual local laws recur explicitly. */
export const HOLIDAYS: CalendarOverlay[] = [
  ...national(2026, [
    ['02-17', 'Chinese New Year', 'Special non-working day'],
    ['04-02', 'Maundy Thursday', 'Regular holiday'],
    ['04-03', 'Good Friday', 'Regular holiday'],
    ['04-04', 'Black Saturday', 'Special non-working day'],
    ['08-31', 'National Heroes Day', 'Regular holiday'],
  ], proclamation2026),
  { id: 'ph-2026-03-20', date: '2026-03-20', title: "Eid’l Fitr", detail: 'Regular holiday', kind: 'ph' as const, source: 'https://pco.gov.ph/news_releases/proclamation-no-1189-s-2026-declaring-friday-20-march-2026-a-regular-holiday-throughout-the-country-in-observance-of-eidl-fitr-feast-of-ramadhan/' },
  { id: 'ph-2026-05-27', date: '2026-05-27', title: "Eid’l Adha", detail: 'Regular holiday', kind: 'ph' as const, source: 'https://pco.gov.ph/news_releases/palace-declares-may-27-as-a-regular-holiday-for-eidl-adha-observance/' },
  ...national(2027, [
    ['02-06', 'Chinese New Year', 'Special non-working day'],
    ['03-25', 'Maundy Thursday', 'Regular holiday'],
    ['03-26', 'Good Friday', 'Regular holiday'],
    ['03-27', 'Black Saturday', 'Special non-working day'],
    ['08-30', 'National Heroes Day', 'Regular holiday'],
  ], proclamation2027),
  { id: 'ne-2026-04-25', date: '2026-04-25', title: 'Nueva Ecija Founding Anniversary', detail: 'Nueva Ecija · Special non-working day', kind: 'local' as const, source: 'https://lawphil.net/executive/proc/proc2026/pdf/proc_1211_2026.pdf' },
  ...[2026, 2027].map(year => ({ id: `ne-${year}-09-02`, date: `${year}-09-02`, title: 'Araw ng Nueva Ecija', detail: 'Nueva Ecija · Special non-working day', kind: 'local' as const, source: 'https://lawphil.net/statutes/repacts/ra1992/ra_7596_1992.html' })),
].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));

/** Traditional references, not announced 2026/2027 programs or holiday declarations. */
export const FIESTAS: CalendarOverlay[] = [2026, 2027].flatMap(year => [
  { id: `quezon-festival-${year}`, date: `${year}-01-30`, title: 'Patimyas Ani Festival', kind: 'festival' as const, detail: 'Quezon, Nueva Ecija · Traditional date; LGU program to confirm', source: 'https://commons.wikimedia.org/wiki/File:Patimyas_Gintong_Ani_2020,_Quezon,_Nueva_Ecija.jpg', sourceLabel: 'Historical reference' },
  ...['01', '02', '03'].map(day => ({ id: `quezon-fiesta-${year}-02-${day}`, date: `${year}-02-${day}`, title: 'Quezon Town Fiesta', kind: 'festival' as const, detail: 'Quezon, Nueva Ecija · Traditional Feb 1–3 period; LGU program to confirm', source: 'https://www.scribd.com/document/735555637/Festivals-and-Founding-Anniversary-Province-of-Nueva-Ecija-2020', sourceLabel: 'Historical reference' })),
]);
export const OVERLAY_COLORS = { ph: 'bg-cyan-500', local: 'bg-violet-500', birthday: 'bg-rose-500', festival: 'bg-emerald-500' };
export const EMPTY_OVERLAY_FILTERS = { ph: false, local: false, birthday: false, festival: false };
export function calendarOverlays(year: number, birthdays: BirthdayCelebrant[], filters: typeof EMPTY_OVERLAY_FILTERS, search = ''): CalendarOverlay[] {
  const entries = [...HOLIDAYS, ...FIESTAS].filter(item => item.date.startsWith(`${year}-`) && filters[item.kind]);
  if (filters.birthday) for (const birthday of birthdays) {
    const monthDay = birthday.birthDate?.slice(5, 10);
    if (!/^\d{2}-\d{2}$/.test(monthDay || '')) continue;
    const date = `${year}-${monthDay}`;
    const actual = new Date(`${date}T12:00:00`);
    // A Feb 29 birthday appears on Feb 29 in leap years, never on an invented date.
    if (Number.isNaN(actual.getTime()) || actual.getMonth() + 1 !== Number(monthDay.slice(0, 2)) || actual.getDate() !== Number(monthDay.slice(3))) continue;
    entries.push({ id: `birthday-${birthday.id}-${year}`, date, title: birthday.name, detail: 'Birthday', kind: 'birthday' });
  }
  const query = search.trim().toLowerCase();
  return entries.filter(item => !query || `${item.title} ${item.detail}`.toLowerCase().includes(query));
}
