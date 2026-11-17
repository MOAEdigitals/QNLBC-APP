import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';

export interface PracticeDownload {
  accountId: string;
  practiceId: string;
  songTitle: string;
  trackId: string;
}

const storage = { directory: Directory.Data };
const downloads = new Set<string>();
const audioExtensions = ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'opus', 'webm', 'flac', 'mp4'];

function safeName(name: string) {
  return name.normalize('NFC').replace(/[^\p{L}\p{N} _-]/gu, '_').trim().slice(0, 70) || 'Untitled';
}

function accountFolder(track: PracticeDownload) {
  return `Practice/${safeName(track.accountId)}`;
}

function practiceSuffix(track: PracticeDownload) {
  return `--${safeName(track.practiceId)}`;
}

function folder(track: PracticeDownload) {
  return `${accountFolder(track)}/${safeName(track.songTitle)}${practiceSuffix(track)}`;
}

function trackName(track: PracticeDownload) {
  return safeName(track.trackId);
}

async function findInFolder(root: string, name: string) {
  const { files } = await Filesystem.readdir({ ...storage, path: root }).catch(() => ({ files: [] }));
  const file = files.find(item => item.type === 'file' && item.size > 0 && audioExtensions.some(ext => item.name === `${name}.${ext}`));
  return file ? { path: `${root}/${file.name}`, src: Capacitor.convertFileSrc(file.uri) } : null;
}

export async function findPracticeDownload(track: PracticeDownload) {
  const root = folder(track);
  const name = trackName(track);
  const current = await findInFolder(root, name);
  if (current) return current;
  const account = accountFolder(track);
  const { files } = await Filesystem.readdir({ ...storage, path: account }).catch(() => ({ files: [] }));
  for (const entry of files) {
    const candidate = `${account}/${entry.name}`;
    if (entry.type !== 'directory' || candidate === root || !entry.name.endsWith(practiceSuffix(track))) continue;
    const saved = await findInFolder(candidate, name);
    if (saved) return saved;
  }
  return null;
}

export async function removePracticeDownload(path: string) {
  await Filesystem.deleteFile({ ...storage, path });
}

function audioExtension(source: string) {
  const mediaType = source.match(/^data:audio\/([\w-]+)[;,]/i)?.[1]?.toLowerCase();
  if (mediaType === 'mpeg') return 'mp3';
  if (mediaType === 'mp4' || mediaType === 'x-m4a') return 'm4a';
  const ext = mediaType || source.split(/[?#]/, 1)[0].match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || '';
  return audioExtensions.includes(ext) ? ext : 'mp3';
}

function verifyAudio(src: string) {
  return new Promise<void>((resolve, reject) => {
    const audio = new Audio();
    const close = (error?: Error) => {
      window.clearTimeout(timer);
      audio.onloadedmetadata = null;
      audio.onerror = null;
      audio.removeAttribute('src');
      audio.load();
      if (error) reject(error); else resolve();
    };
    const timer = window.setTimeout(() => close(new Error('Could not read the audio file.')), 10000);
    audio.onloadedmetadata = () => close();
    audio.onerror = () => close(new Error('This link did not return playable audio.'));
    audio.preload = 'metadata';
    audio.src = src;
  });
}

export async function downloadPracticeTrack(track: PracticeDownload, source: string) {
  const basename = `${folder(track)}/${trackName(track)}`;
  if (downloads.has(basename)) throw new Error('This track is already downloading.');
  downloads.add(basename);
  const ext = audioExtension(source);
  const temp = `${basename}.pending.${ext}`;
  const path = `${basename}.${ext}`;
  try {
    const existing = await findPracticeDownload(track);
    if (existing) return existing;
    if (/^https?:\/\//i.test(source)) {
      await Filesystem.downloadFile({ ...storage, url: source, path: temp, recursive: true, connectTimeout: 15000, readTimeout: 60000 });
    } else {
      const data = source.match(/^data:audio\/[^;,]+(?:;[^,]*)?;base64,([\s\S]+)$/i)?.[1];
      if (!data) throw new Error('This audio is unavailable for download.');
      await Filesystem.writeFile({ ...storage, path: temp, data, recursive: true });
    }
    const { uri, size } = await Filesystem.stat({ ...storage, path: temp });
    if (!size) throw new Error('The downloaded file was empty.');
    await verifyAudio(Capacitor.convertFileSrc(uri));
    await Filesystem.rename({ ...storage, from: temp, to: path });
    return { path, src: Capacitor.convertFileSrc((await Filesystem.getUri({ ...storage, path })).uri) };
  } finally {
    await Filesystem.deleteFile({ ...storage, path: temp }).catch(() => {});
    downloads.delete(basename);
  }
}
