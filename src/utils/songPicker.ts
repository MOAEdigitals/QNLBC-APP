import type { Song } from '../types';

export type PickerSort = 'relevance' | 'az' | 'za' | 'tracks-first' | 'recently-sung' | 'least-recently-sung' | 'recently-added';
export const PICKER_SORTS: { value: PickerSort; label: string }[] = [
  { value: 'relevance', label: 'Relevance' }, { value: 'az', label: 'Title: A–Z' }, { value: 'za', label: 'Title: Z–A' },
  { value: 'tracks-first', label: 'Attached tracks first' }, { value: 'recently-sung', label: 'Recently Sung' },
  { value: 'least-recently-sung', label: 'Not Sung Recently' }, { value: 'recently-added', label: 'Recently Added' },
];
export function pickerCategories(song: Song): string[] {
  const values = song.categories?.length ? song.categories : (song.category || '').split(',');
  return values.map(value => value.trim()).filter(value => value && value.toLowerCase() !== 'uncategorized');
}
export function matchesPickerCategory(song: Song, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'starred') return Boolean(song.isStarred || song.starred);
  const categories = pickerCategories(song);
  return filter === 'uncategorized' ? !categories.length : categories.includes(filter);
}
interface SortableSong { title: string; songObj?: Song; score?: number; history?: { lastDate?: string | null } }
export function comparePickerSongs(a: SortableSong, b: SortableSong, mode: PickerSort): number {
  if (mode === 'relevance') return (b.score || 0) - (a.score || 0);
  const title = a.title.localeCompare(b.title);
  if (mode === 'az') return title;
  if (mode === 'za') return -title;
  if (mode === 'tracks-first') {
    const tracks = (song?: Song) => Boolean(song && (song.minusOneLink || song.minus_one_link || song.attachments?.some(track => (track.urlOrData || track.url) && ['audio', 'video', 'link'].includes(track.type))));
    return Number(tracks(b.songObj)) - Number(tracks(a.songObj)) || title;
  }
  if (mode === 'recently-added') return (b.songObj?.createdAt || b.songObj?.created_at || '').localeCompare(a.songObj?.createdAt || a.songObj?.created_at || '') || title;
  const first = a.history?.lastDate || '', second = b.history?.lastDate || '';
  return (mode === 'recently-sung' ? second.localeCompare(first) : first.localeCompare(second)) || title;
}
