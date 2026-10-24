import type { Song, SongAttachment } from '../types';

export interface SongNavigationRequest { songId: string; timestamp: number; mediaUrl?: string }
export interface SongPlaybackMedia { id: string; name: string; url: string; type: SongAttachment['type'] }

/** Open the scheduled link in the existing library player without changing the song record. */
export function scheduledSongMedia(song: Song, mediaUrl: string): SongPlaybackMedia {
  const url = mediaUrl.trim();
  const attachment = song.attachments?.find(item => (item.urlOrData ?? item.url)?.trim() === url);
  let path = url.toLowerCase();
  try { path = new URL(url).pathname.toLowerCase(); } catch { /* Data URLs retain their prefix. */ }
  const inferred = /\.(mp3|m4a|aac|wav|ogg|flac|opus)$/.test(path) || path.startsWith('data:audio/') ? 'audio'
    : /\.(mp4|webm|mov|mkv)$/.test(path) || path.startsWith('data:video/') ? 'video' : 'link';
  return { id: attachment?.id || `schedule-media-${song.id}`, name: attachment?.name || `Minus-one · ${song.title}`, url, type: attachment?.type && attachment.type !== 'link' ? attachment.type : inferred };
}
