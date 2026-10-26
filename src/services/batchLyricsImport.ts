import { supabase } from '../supabase';
import { cleanLeadingSongTitle } from '../utils/songLyrics';
import { songTitleCase } from '../utils/songTitleCase';

function fingerprint(title: string, lyrics: string): string {
  return cleanLeadingSongTitle(title, lyrics).normalize('NFKC').replace(/[‘’]/g, "'").toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}
async function importId(lyricsKey: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`qnlbc-lyrics-import-v1\n${lyricsKey}`));
  const bytes = new Uint8Array(hash).slice(0, 16);
  bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export async function importBatchLyricsTxt(files: FileList | File[] | string, progress: (message: string) => void = () => {}) {
  if (typeof files === 'string') throw new Error('Select the actual .txt song files to import.');
  const selected = Array.from(files);
  if (!selected.length) throw new Error('Select at least one .txt file.');
  const existing: { id: string; title: string; lyrics: string }[] = [];
  progress('Checking the current song library…');
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('songs').select('id,title,lyrics').is('deleted_at', null).order('id').range(offset, offset + 499);
    if (error) throw new Error('Could not check the existing songs. Nothing was imported.');
    existing.push(...(data || []));
    if (!data || data.length < 500) break;
  }
  const seen = new Set(existing.map(song => fingerprint(song.title, song.lyrics)).filter(Boolean));
  const batch = crypto.randomUUID();
  const prepared: { id: string; title: string; lyrics: string; metadata: Record<string, unknown> }[] = [];
  let skippedDuplicates = 0, skippedEmpty = 0;
  for (const [index, file] of selected.entries()) {
    progress(`Reading song files ${index + 1} of ${selected.length}…`);
    if (!/\.txt$/i.test(file.name)) throw new Error(`Choose .txt files only: ${file.name}. Nothing was imported.`);
    const sourceTitle = file.name.replace(/\.txt$/i, '').trim();
    let text: string;
    try {
      const bytes = await file.arrayBuffer();
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch { text = new TextDecoder('windows-1252').decode(bytes); }
    } catch { throw new Error(`Could not read ${file.name}. Nothing was imported.`); }
    const lyrics = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
    if (!sourceTitle || !lyrics) { skippedEmpty++; continue; }
    const key = fingerprint(sourceTitle, lyrics);
    if (seen.has(key)) { skippedDuplicates++; continue; }
    seen.add(key);
    const title = songTitleCase(sourceTitle);
    prepared.push({ id: await importId(key), title, lyrics, metadata: { importBatchId: batch, importFilename: file.name, importedAt: new Date().toISOString(), previousTitles: sourceTitle === title ? [] : [sourceTitle] } });
  }
  let addedCount = 0, alreadySaved = 0;
  for (let offset = 0; offset < prepared.length; offset += 25) {
    progress(`Saving new songs ${offset + 1}–${Math.min(offset + 25, prepared.length)} of ${prepared.length}…`);
    // Stable content IDs + DO NOTHING keep retries from overwriting or duplicating songs.
    const { data, error } = await supabase.from('songs').upsert(prepared.slice(offset, offset + 25), { onConflict: 'id', ignoreDuplicates: true }).select('id');
    if (error || !Array.isArray(data)) throw new Error(`Import stopped after ${addedCount} confirmed new songs. ${error?.message || 'The save could not be confirmed.'} You can select the files again to retry safely.`);
    addedCount += data.length;
    alreadySaved += Math.min(25, prepared.length - offset) - data.length;
  }
  skippedDuplicates += alreadySaved;
  return { success: true, addedCount, updatedCount: 0, importedCount: addedCount, totalSongs: existing.length + addedCount, skippedDuplicates, skippedEmpty,
    message: `Saved ${addedCount} new songs. Skipped ${skippedDuplicates} identical-lyrics duplicates and ${skippedEmpty} empty files. Existing songs were kept. Similar versions still need lyrics review.` };
}
