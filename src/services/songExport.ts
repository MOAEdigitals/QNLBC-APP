import JSZip from 'jszip';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { supabase } from '../supabase';
import { mapSongFromDB } from './supabaseData';

async function readSongs(): Promise<Record<string, any>[]> {
  const songs: Record<string, any>[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('songs').select('*').is('deleted_at', null).order('id').range(offset, offset + 499);
    if (error) throw new Error('Could not export all songs. Please try again.');
    songs.push(...(data || []));
    if (!data || data.length < 500) return songs;
  }
}
export async function buildSongsArchive(rows: Record<string, any>[]): Promise<Uint8Array> {
  const zip = new JSZip();
  const used = new Set<string>();
  for (const song of rows) {
    const title = String(song.title || 'Untitled').normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/g, '').slice(0, 120) || 'Untitled';
    let name = title;
    for (let copy = 2; used.has(name.toLowerCase()); copy++) name = `${title} (${copy})`;
    used.add(name.toLowerCase());
    zip.file(`lyrics/${name}.txt`, String(song.lyrics || ''));
  }
  zip.file('songs-backup.json', JSON.stringify({ format: 'qnlbc-songs-backup', version: 1, exportedAt: new Date().toISOString(),
    songs: rows.map(row => ({ ...mapSongFromDB(row), lyrics: row.lyrics || '' })), rawSongs: rows,
    scope: 'All current songs and lyrics. Media references are preserved; audio/video files are not embedded. Other church records and accounts are excluded.' }, null, 2));
  zip.file('README.txt', 'QNLBC songs-only backup\n\nlyrics/: one UTF-8 text file per song. Duplicate filenames have numbered suffixes; no songs were merged or removed.\nsongs-backup.json: song IDs, details, exact lyrics and original database rows. Extract this JSON for the existing JSON restore option.\nMedia links are included, but audio/video files are not downloaded. Use Full Data Export for a backup with recordings.\n');
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
export async function exportAllSongs(progress: (message: string) => void): Promise<number> {
  progress('Loading all songs…');
  const rows = await readSongs();
  progress(`Verifying ${rows.length} songs…`);
  if (JSON.stringify(rows) !== JSON.stringify(await readSongs())) throw new Error('Songs changed during export. Please try again after editing has finished.');
  progress(`Preparing ${rows.length} songs…`);
  const bytes = await buildSongsArchive(rows);
  const filename = `QNLBC-Songs-${new Date().toISOString().slice(0,10)}.zip`;
  if (Capacitor.isNativePlatform()) {
    // Android WebViews do not reliably download blob URLs. Use the native Save/Share sheet.
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 16384) binary += String.fromCharCode(...bytes.subarray(offset, offset + 16384));
    const file = await Filesystem.writeFile({ path: filename, data: btoa(binary), directory: Directory.Cache });
    await Share.share({ title: 'QNLBC songs backup', files: [file.uri], dialogTitle: 'Save songs backup' });
  } else {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/zip' }));
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  return rows.length;
}
