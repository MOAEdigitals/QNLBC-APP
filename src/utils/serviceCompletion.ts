const dateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function philippineDate(now: number | Date = Date.now()) {
  return dateFormat.format(now);
}

export function serviceEnd(date: string, title = '', type?: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NaN;
  let hour = 24;
  if (type === 'sunday' || /sunday\s*service/i.test(title)) hour = 12;
  else if (type === 'prayer' || type === 'prayer_meeting' || /prayer\s*meeting|midweek\s*prayer/i.test(title)) hour = 20;
  else if (/(?:song\s*leaders?|choir).*practice|practice.*(?:song\s*leaders?|choir)|saturday.*practice/i.test(title)) hour = 19;
  return Date.parse(date + 'T' + String(hour).padStart(2, '0') + ':00:00+08:00');
}

export function serviceCompleted(date: string, title: string, now = Date.now(), type?: string) {
  const end = serviceEnd(date, title, type);
  return Number.isFinite(end) && now >= end;
}
