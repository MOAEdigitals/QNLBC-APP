import type { Song } from '../types';

/** An older in-flight refresh must not undo a newer confirmed save. */
export function newestSong(current: Song | undefined, incoming: Song): Song {
  return current && (Number(current.revision) || 0) > (Number(incoming.revision) || 0) ? current : incoming;
}

/** Snapshot membership remains authoritative, including server-side deletions. */
export function mergeSongSnapshot(current: Song[], incoming: Song[]): Song[] {
  const byId = new Map(current.map(song => [song.id, song]));
  return incoming.map(song => newestSong(byId.get(song.id), song));
}
