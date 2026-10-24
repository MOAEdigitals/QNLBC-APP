import type { Song, Setlist } from '../types';

export function getUpcomingSongSchedule(song: Song, setlists: Setlist[], todayKey?: string): Setlist | undefined {
  const today = new Date();
  todayKey ??= `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const normalize = (title?: string) => title?.trim().toLocaleLowerCase();
  const title = normalize(song.title);
  const includesSong = (item: { songId?: string; song_id?: string; title?: string }) => {
    const id = item.songId ?? item.song_id;
    return id ? id === song.id : normalize(item.title) === title;
  };
  return setlists.filter(setlist => setlist.date >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date))
    .find(setlist => [setlist.welcomeSong ?? setlist.welcome_song, setlist.closingSong ?? setlist.closing_song, setlist.themeSong ?? setlist.theme_song]
      .some(name => Boolean(name) && normalize(name) === title)
      || [setlist.sundaySchool?.songs, setlist.worshipService?.songs, setlist.program?.songs].some(items => items?.some(includesSong)));
}
