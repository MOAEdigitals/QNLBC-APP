import type { Song } from '../types';

export function compareTracksFirst(a: Song, b: Song): number {
  const hasTracks = (song: Song) => Boolean(song.minusOneLink || song.minus_one_link ||
    song.attachments?.some(track => (track.urlOrData || track.url) && ['audio', 'video', 'link'].includes(track.type)));
  return Number(hasTracks(b)) - Number(hasTracks(a)) || a.title.localeCompare(b.title);
}
