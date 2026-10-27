import type { LocalSongFile } from './model';
import type { Song } from '../../types';
let database: Promise<IDBDatabase> | undefined;
function db() {
  return database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('qnlbc_song_downloads_v1', 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('files'); request.result.createObjectStore('records', { keyPath: 'id' }); request.result.createObjectStore('songs', { keyPath: 'id' }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = undefined; reject(new Error('Local storage is unavailable.')); };
    request.onblocked = () => { database = undefined; reject(new Error('Close other QNLBC windows and retry.')); };
  });
}
export async function cacheDownloadedSongs(songs: Song[]): Promise<void> {
  if (!songs.length) return;
  const database = await db();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('songs', 'readwrite');
    for (const song of songs) transaction.objectStore('songs').put({ id: song.id, title: song.title, lyrics: song.lyrics, updatedAt: song.updatedAt, artist: song.artist, categories: song.categories, category: song.category, minusOneLink: song.minusOneLink || song.minus_one_link, attachments: (song.attachments || []).filter(item => /^https:\/\//i.test(item.urlOrData || item.url || '')) });
    transaction.oncomplete = () => resolve(); transaction.onerror = transaction.onabort = () => reject(new Error('Could not save lyrics for offline use.'));
  });
}
export async function readDownloadedSongs(): Promise<Song[]> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const request = database.transaction('songs').objectStore('songs').getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
export async function listWebFiles(): Promise<LocalSongFile[]> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const request = database.transaction('records').objectStore('records').getAll();
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
export async function saveWebFile(record: LocalSongFile, blob: Blob): Promise<void> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['records', 'files'], 'readwrite');
    transaction.objectStore('files').put(blob, record.id); transaction.objectStore('records').put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = transaction.onabort = () => reject(new Error('Not enough local storage, or the download could not be saved.'));
  });
}
export async function removeWebFile(id: string): Promise<void> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(['records', 'files'], 'readwrite');
    transaction.objectStore('files').delete(id); transaction.objectStore('records').delete(id);
    transaction.oncomplete = () => resolve(); transaction.onerror = transaction.onabort = () => reject(new Error('Could not remove local file.'));
  });
}
export async function readWebFile(id: string): Promise<Blob> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const request = database.transaction('files').objectStore('files').get(id);
    request.onsuccess = () => request.result instanceof Blob && request.result.size > 0 ? resolve(request.result) : reject(new Error('Local file is missing. Remove the saved copy and download again.'));
    request.onerror = () => reject(new Error('Could not open local file.'));
  });
}
