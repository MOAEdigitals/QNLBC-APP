import type { Song, Setlist, SetlistSongItem } from '../types';

export function songResolver(songs: Song[]) {
  const byId = new Map(songs.map(song => [song.id, song]));
  const byTitle = new Map<string, Set<Song>>();
  for (const song of songs) {
    for (const title of [song.title, ...(song.previousTitles || [])]) {
      const key = title.trim().toLowerCase();
      if (!key) continue;
      const matches = byTitle.get(key) || new Set<Song>();
      matches.add(song);
      byTitle.set(key, matches);
    }
  }
  return (id?: string, title?: string): Song | undefined => {
    // Never redirect an explicit link to another song with the same title.
    if (id) return byId.get(id);
    const matches = byTitle.get((title || '').trim().toLowerCase());
    return matches?.size === 1 ? [...matches][0] : undefined;
  };
}

type Resolver = ReturnType<typeof songResolver>;
type SongUse = { songId?: string; song_id?: string; songTitle?: string; song_title?: string };
export function linkSongEntry<T extends SongUse>(entry: T, resolve: Resolver): T {
  const song = resolve(entry.songId || entry.song_id, entry.songTitle || entry.song_title);
  return song ? { ...entry, songId: song.id, song_id: song.id, songTitle: song.title,
    song_title: song.title, lyrics: song.lyrics, lyricsMode: 'live', lyrics_mode: 'live',
    lyricsSnapshot: song.lyrics, lyrics_snapshot: song.lyrics } : entry;
}

export function linkSetlist(setlist: Setlist, resolve: Resolver): Setlist {
  const item = (entry: SetlistSongItem): SetlistSongItem => {
    const song = resolve(entry.songId || entry.song_id, entry.title);
    return song ? { ...entry, songId: song.id, song_id: song.id, title: song.title,
      lyricsMode: 'live', lyrics_mode: 'live', lyricsSnapshot: song.lyrics, lyrics_snapshot: song.lyrics } : entry;
  };
  const named = (title?: string) => resolve(undefined, title)?.title || title;
  return { ...setlist,
    welcomeSong: named(setlist.welcomeSong || setlist.welcome_song),
    welcome_song: named(setlist.welcomeSong || setlist.welcome_song),
    closingSong: named(setlist.closingSong || setlist.closing_song),
    closing_song: named(setlist.closingSong || setlist.closing_song),
    themeSong: named(setlist.themeSong || setlist.theme_song),
    theme_song: named(setlist.themeSong || setlist.theme_song),
    sundaySchool: setlist.sundaySchool && { ...setlist.sundaySchool, songs: setlist.sundaySchool.songs.map(item) },
    worshipService: setlist.worshipService && { ...setlist.worshipService, songs: setlist.worshipService.songs.map(item) },
    program: setlist.program && { ...setlist.program, songs: setlist.program.songs.map(item) },
  };
}
