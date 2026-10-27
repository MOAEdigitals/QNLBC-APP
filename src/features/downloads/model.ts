import type { Song } from '../../types';

export interface LocalSongFile {
  id: string; sourceKey: string; sourceUrl: string; songId: string; title: string;
  fileName: string; type: 'audio' | 'video'; size: number; downloadedAt: string; uri?: string;
}
export interface SongFileSource { url: string; type: string; title: string; songId: string; song?: Song }

export function youtubeVideoId(raw: string): string | null {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    let id: string | null = null;
    if (host === 'youtu.be') id = url.pathname.split('/')[1];
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(host)) {
      id = url.pathname === '/watch' ? url.searchParams.get('v') : /^\/(shorts|embed|live)\//.test(url.pathname) ? url.pathname.split('/')[2] : null;
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}
export function sourceKey(raw: string): string | null {
  const id = youtubeVideoId(raw);
  if (id) return `https://www.youtube.com/watch?v=${id}`;
  try { const url = new URL(raw.trim()); if (url.protocol !== 'https:' || url.username || url.password) return null; url.hash = ''; return url.toString(); } catch { return null; }
}
export function canDownload(source: SongFileSource): boolean {
  return !!sourceKey(source.url) && (!!youtubeVideoId(source.url) || ['audio', 'video'].includes(source.type) || /\.(mp3|mp4|webm|m4a|wav|ogg|aac|mov)(?:[?#]|$)/i.test(source.url));
}
export function songFileSources(song: Song): SongFileSource[] {
  const files: SongFileSource[] = (song.attachments || []).map(attachment => ({ url: attachment.urlOrData || attachment.url || '', type: attachment.type, title: attachment.name, songId: song.id }));
  const legacy = song.minusOneLink || song.minus_one_link;
  if (legacy) files.push({ url: legacy, type: 'link', title: `${song.title} — Minus One`, songId: song.id });
  return files;
}
export function localSongStats(song: Song, files: LocalSongFile[]) {
  const sources = new Set(songFileSources(song).map(source => sourceKey(source.url)).filter(Boolean));
  const matches = files.filter(file => sources.has(file.sourceKey));
  return { count: matches.length, size: matches.reduce((total, file) => total + file.size, 0), latest: matches.reduce((latest, file) => file.downloadedAt > latest ? file.downloadedAt : latest, '') };
}
export function formatFileSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
