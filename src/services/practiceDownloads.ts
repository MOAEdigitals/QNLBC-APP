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

async function detectAudioExtension(src: string, fallback: string) {
  const response = await fetch(src, { headers: { Range: 'bytes=0-31' }, signal: AbortSignal.timeout(5000) });
  const reader = response.body?.getReader();
  if (!reader) return fallback;
  try {
    const { value } = await reader.read();
    if (!value || value.length < 12) return fallback;
    const tag = String.fromCharCode(...value.subarray(0, 12));
    if (value[0] === 0x1a && value[1] === 0x45 && value[2] === 0xdf && value[3] === 0xa3) return 'webm';
    if (tag.startsWith('OggS')) return 'ogg';
    if (tag.startsWith('fLaC')) return 'flac';
    if (tag.startsWith('RIFF') && tag.endsWith('WAVE')) return 'wav';
    if (tag.slice(4, 8) === 'ftyp') return 'm4a';
    if (tag.startsWith('ID3')) return 'mp3';
    return fallback;
  } finally {
    await reader.cancel().catch(() => {});
  }
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
  let stagedPath = temp;
  try {
    const existing = await findPracticeDownload(track);
    if (existing) return existing;
    const root = folder(track);
    await Filesystem.mkdir({ ...storage, path: root, recursive: true }).catch(() => Filesystem.readdir({ ...storage, path: root }));
    const remote = /^https?:\/\//i.test(source);
    if (remote) {
      await Filesystem.downloadFile({ ...storage, url: source, path: temp, connectTimeout: 15000, readTimeout: 60000 });
    } else {
      const data = source.match(/^data:audio\/[^;,]+(?:;[^,]*)?;base64,([\s\S]+)$/i)?.[1];
      if (!data) throw new Error('This audio is unavailable for download.');
      await Filesystem.writeFile({ ...storage, path: temp, data });
    }
    const { uri, size } = await Filesystem.stat({ ...storage, path: temp });
    if (!size) throw new Error('The downloaded file was empty.');
    const finalExt = remote ? await detectAudioExtension(Capacitor.convertFileSrc(uri), ext).catch(() => ext) : ext;
    if (finalExt !== ext) {
      const correctFormat = `${basename}.pending.${finalExt}`;
      await Filesystem.rename({ ...storage, from: temp, to: correctFormat });
      stagedPath = correctFormat;
    }
    const localUri = (await Filesystem.getUri({ ...storage, path: stagedPath })).uri;
    await verifyAudio(Capacitor.convertFileSrc(localUri));
    const path = `${basename}.${finalExt}`;
    await Filesystem.rename({ ...storage, from: stagedPath, to: path });
    return { path, src: Capacitor.convertFileSrc((await Filesystem.getUri({ ...storage, path })).uri) };
  } finally {
    await Filesystem.deleteFile({ ...storage, path: stagedPath }).catch(() => {});
    downloads.delete(basename);
  }
}
