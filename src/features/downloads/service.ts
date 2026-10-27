import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { sourceKey, youtubeVideoId, canDownload, type LocalSongFile, type SongFileSource } from './model';
import { listWebFiles, saveWebFile, removeWebFile, readWebFile, cacheDownloadedSongs } from './storage';
import { resolveMediaUrl } from '../../utils/mediaUtils';

interface Progress { sourceKey: string; progress: number; stage: string }
interface NativeDownloads {
  list(): Promise<{ items: LocalSongFile[] }>;
  download(source: SongFileSource & { sourceUrl: string; downloadUrl: string }): Promise<LocalSongFile>;
  remove(options: { id: string }): Promise<void>;
  cancel(options: { sourceKey: string }): Promise<void>;
  addListener(event: 'progress', callback: (progress: Progress) => void): Promise<PluginListenerHandle>;
}
const native = registerPlugin<NativeDownloads>('SongDownloads');
export const isNativeDownload = () => Capacitor.getPlatform() === 'android' && Capacitor.isNativePlatform();
export interface DownloadJob { progress: number; stage: string; error?: string; running: boolean }
interface Snapshot { ready: boolean; items: LocalSongFile[]; jobs: Record<string, DownloadJob>; error: string }
let snapshot: Snapshot = { ready: false, items: [], jobs: {}, error: '' };
const listeners = new Set<() => void>();
const work = new Map<string, Promise<void>>();
const controllers = new Map<string, AbortController>();
let loading: Promise<void> | undefined, nativeListener: Promise<PluginListenerHandle> | undefined;
export const getDownloadSnapshot = () => snapshot;
export const subscribeDownloads = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function publish(patch: Partial<Snapshot>) { snapshot = { ...snapshot, ...patch }; listeners.forEach(listener => listener()); }
function job(key: string, value: DownloadJob) { publish({ jobs: { ...snapshot.jobs, [key]: value } }); }
export function refreshDownloads(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    try { const items = isNativeDownload() ? (await native.list()).items : await listWebFiles(); publish({ ready: true, items, error: '' }); }
    catch (error) { publish({ ready: true, error: (error as Error).message }); }
  })().finally(() => { loading = undefined; });
  return loading;
}
async function webDownload(source: SongFileSource, key: string, signal: AbortSignal): Promise<LocalSongFile> {
  if (youtubeVideoId(key)) throw new Error('YouTube video downloads are available in the Android app.');
  const response = await fetch(resolveMediaUrl(key), { signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new Error(`Download failed (HTTP ${response.status}).`);
  const mime = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() || '';
  const knownFile = /\.(mp3|mp4|webm|m4a|wav|ogg|aac|mov)(?:[?#]|$)/i.exec(key)?.[1]?.toLowerCase();
  if (!mime.startsWith('audio/') && !mime.startsWith('video/') && !(mime === 'application/octet-stream' && knownFile)) throw new Error('This link does not provide a direct audio/video file.');
  const limit = 250 * 1024 * 1024, total = Number(response.headers.get('content-length')) || 0;
  if (total > limit) { await response.body?.cancel(); throw new Error('File is larger than 250 MB.'); }
  const reader = response.body?.getReader(); if (!reader) throw new Error('This browser cannot save this download.');
  const chunks: Uint8Array[] = []; let size = 0, last = 0;
  try {
    while (true) { const part = await reader.read(); if (part.done) break; chunks.push(part.value); size += part.value.byteLength; if (size > limit) throw new Error('File is larger than 250 MB.');
      const now = Date.now(); if (now - last > 200) { job(key, { running: true, progress: total ? Math.min(99, Math.floor(size / total * 100)) : 0, stage: 'Downloading' }); last = now; }
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  if (!size) throw new Error('The downloaded file was empty.');
  const blob = new Blob(chunks as BlobPart[], { type: mime });
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  const id = Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('');
  const type = mime.startsWith('video/') || ['mp4', 'webm', 'mov'].includes(knownFile || '') ? 'video' : 'audio';
  const ext = knownFile || (mime === 'audio/mpeg' ? 'mp3' : mime.split('/')[1]?.replace(/[^a-z0-9]/g, '') || (type === 'video' ? 'mp4' : 'm4a'));
  const record: LocalSongFile = { id, sourceKey: key, sourceUrl: key, songId: source.songId, title: source.title, fileName: `${id}.${ext}`, type, size, downloadedAt: new Date().toISOString() };
  await saveWebFile(record, blob); return record;
}
export function downloadSongFile(source: SongFileSource): Promise<void> {
  const key = sourceKey(source.url); if (!key || !canDownload(source)) return Promise.reject(new Error('Use a direct audio/video file or a YouTube video link.'));
  const active = work.get(key); if (active) return active;
  const controller = new AbortController(); controllers.set(key, controller);
  job(key, { progress: 0, stage: 'Preparing', running: true });
  const promise = (async () => {
    try {
      await refreshDownloads(); if (snapshot.error) throw new Error(snapshot.error);
      if (source.song) await cacheDownloadedSongs([source.song]);
      if (snapshot.items.some(item => item.sourceKey === key)) { job(key, { progress: 100, stage: 'Downloaded', running: false }); return; }
      let record: LocalSongFile;
      if (isNativeDownload()) {
        await (nativeListener ??= native.addListener('progress', progress => { if (work.has(progress.sourceKey)) job(progress.sourceKey, { progress: progress.progress, stage: progress.stage, running: true }); }));
        if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        record = await native.download({ ...source, url: key, sourceUrl: key, downloadUrl: resolveMediaUrl(key) });
      } else record = await webDownload(source, key, controller.signal);
      publish({ items: [...snapshot.items.filter(item => item.sourceKey !== key), record] });
      job(key, { progress: 100, stage: 'Downloaded', running: false });
      if (!isNativeDownload()) void navigator.storage?.persist?.().catch(() => false);
    } catch (error) { job(key, { progress: 0, stage: 'Retry', running: false, error: controller.signal.aborted ? 'Download cancelled.' : (error as Error).message }); }
    finally { controllers.delete(key); work.delete(key); }
  })();
  work.set(key, promise); return promise;
}
export async function cancelSongDownload(key: string) { controllers.get(key)?.abort(); if (isNativeDownload()) await native.cancel({ sourceKey: key }); }
export async function removeSongDownload(file: LocalSongFile) {
  if (work.has(file.sourceKey)) throw new Error('Wait for the download to finish.');
  if (isNativeDownload()) await native.remove({ id: file.id }); else await removeWebFile(file.id);
  publish({ items: snapshot.items.filter(item => item.id !== file.id) });
}
export async function openLocalSongFile(file: LocalSongFile): Promise<{ url: string; release: () => void }> {
  if (isNativeDownload()) { if (!file.uri) throw new Error('Local file is missing. Download again.'); return { url: Capacitor.convertFileSrc(file.uri), release: () => {} }; }
  const url = URL.createObjectURL(await readWebFile(file.id)); return { url, release: () => URL.revokeObjectURL(url) };
}
