import type { Setlist } from '../types';

export const PUBLIC_APP_URL = 'https://moaedigitals.github.io/QNLBC-APP/';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function setlistShareUrl(id: string, base = PUBLIC_APP_URL): string {
  if (!uuid.test(id)) throw new Error('Save this setlist before sharing it.');
  const url = new URL(base);
  url.search = ''; url.hash = 'home'; url.searchParams.set('setlist', id);
  return url.href;
}
export function readSetlistShareId(input: string, base = PUBLIC_APP_URL): string | null {
  try {
    const url = new URL(input), expected = new URL(base);
    if (url.origin !== expected.origin || url.pathname.replace(/\/$/, '') !== expected.pathname.replace(/\/$/, '')) return null;
    const id = url.searchParams.get('setlist');
    return id && uuid.test(id) ? id : null;
  } catch { return null; }
}
export function setlistTitle(item: Pick<Setlist, 'title' | 'type'>): string {
  return item.title?.trim() || ({ sunday: 'Sunday Service', prayer_meeting: 'Midweek Prayer Meeting', fellowship: 'Fellowship', event: 'Special Event' }[item.type || 'sunday']);
}
