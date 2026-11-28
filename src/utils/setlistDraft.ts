import type { Setlist, SetlistSongItem, Song } from '../types';

/** A duplicate stays a draft; identities and stale service dates never carry over. */
export function duplicateSetlist(source: Setlist, date: string, uuid: () => string): Setlist {
  const copy: Setlist = JSON.parse(JSON.stringify(source));
  copy.id = uuid(); copy.date = date; delete copy.service_date;
  delete copy.revision; delete copy.displayOrder; delete copy.display_order;
  delete copy.deletedAt; delete copy.deleted_at;
  delete copy.created_at; delete copy.updated_at;
  copy.createdAt = copy.updatedAt = new Date().toISOString();
  for (const section of [copy.sundaySchool, copy.worshipService, copy.program]) {
    if (!section) continue;
    section.songs = section.songs.map(slot => {
      const result = { ...slot, id: uuid() }; delete result.revision; return result;
    });
  }
  return copy;
}

export interface ReadinessIssue { label: string; detail: string }
export function setlistReadiness(setlist: Setlist, songs: Song[], checkTracks = true): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];
  const sunday = !setlist.type || setlist.type === 'sunday';
  const sections = sunday ? [['Sunday School', setlist.sundaySchool], ['Worship Service', setlist.worshipService]] as const
    : [['Program', setlist.program]] as const;
  if (setlist.type !== 'prayer_meeting' && !setlist.presider?.trim()) issues.push({ label: 'Presider', detail: 'Not assigned' });
  const checkSong = (slot: SetlistSongItem, label: string) => {
    if (!slot.title?.trim()) { issues.push({ label, detail: 'No song selected' }); return; }
    const id = slot.songId || slot.song_id;
    const song = id ? songs.find(song => song.id === id) : songs.find(song => song.title.trim().toLowerCase() === slot.title.trim().toLowerCase());
    const mode = slot.lyricsMode || slot.lyrics_mode;
    const lyrics = mode && mode !== 'live' ? slot.lyricsSnapshot ?? slot.lyrics_snapshot : song?.lyrics;
    if (!lyrics?.trim()) issues.push({ label: slot.title, detail: 'Lyrics missing' });
    if (checkTracks && !song?.minusOneLink && !song?.minus_one_link && !song?.attachments?.some(track => ['audio','video','link'].includes(track.type) && (track.url || track.urlOrData))) {
      issues.push({ label: slot.title, detail: 'No practice track' });
    }
  };
  for (const [name, section] of sections) {
    if (!section?.songLeader?.trim()) issues.push({ label: `${name} song leader`, detail: 'Not assigned' });
    if (!section?.songs?.some(slot => slot.title?.trim())) issues.push({ label: name, detail: 'No songs selected' });
    else section.songs.forEach((slot, index) => checkSong(slot, `${name} song ${index + 1}`));
  }
  for (const [label, title] of [['Welcome song', setlist.welcomeSong || setlist.welcome_song], ['Closing song', setlist.closingSong || setlist.closing_song], ['Theme song', setlist.themeSong || setlist.theme_song]]) {
    if (title) checkSong({ id: '', title }, label!);
  }
  return issues;
}
