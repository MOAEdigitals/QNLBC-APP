import { Capacitor, registerPlugin } from '@capacitor/core';
import { fetchBirthdays, fetchAnniversaries, fetchVisitors, fetchSpecialRecognitions, fetchSpecialNumbers, fetchChoirEntries, fetchPracticeEntries } from './supabaseData';
import { loadSermons } from '../features/sermons/data';
import { loadNotes } from '../features/notepad/data';
import type { ChurchActivity, Setlist, Song, UserAccount } from '../types';

const library = registerPlugin<{
  read(): Promise<{ value?: string } | undefined>;
  write(input: { value: string }): Promise<void>;
  clear(): Promise<void>;
}>('OfflineLibrary');

export const isAndroidOfflineLibrary = () => Capacitor.getPlatform() === 'android';
const SIGNED_OUT_KEY = 'qnlbc.android.signed-out';
export const androidSignedOut = () => {
  try { return isAndroidOfflineLibrary() && window.localStorage.getItem(SIGNED_OUT_KEY) === 'true'; }
  catch { return false; }
};
export const setAndroidSignedOut = (signedOut: boolean) => {
  if (!isAndroidOfflineLibrary()) return;
  try {
    if (signedOut) window.localStorage.setItem(SIGNED_OUT_KEY, 'true');
    else window.localStorage.removeItem(SIGNED_OUT_KEY);
  } catch {}
};

type OfflineAccount = Pick<UserAccount, 'id' | 'username' | 'displayName'>;

async function fetchTextSections(userId: string, previous?: TextSections) {
  async function refresh<T>(label: string, read: () => Promise<T>, cached?: T) {
    try { return await read(); }
    catch (error) {
      console.warn('Offline section sync failed', label, error);
      return cached;
    }
  }
  const [birthdays, anniversaries, visitors, recognitions, songNumbers, choir, practice, outlines, notes] = await Promise.all([
    refresh('birthdays', fetchBirthdays, previous?.birthdays),
    refresh('anniversaries', fetchAnniversaries, previous?.anniversaries),
    refresh('visitors', fetchVisitors, previous?.visitors),
    refresh('recognitions', fetchSpecialRecognitions, previous?.recognitions),
    refresh('song numbers', async () => (await fetchSpecialNumbers()).map(({ minusOneLink, minus_one_link, ...row }) => row), previous?.songNumbers),
    refresh('choir', async () => (await fetchChoirEntries()).map(({ mediaAttachments, ...row }) => row), previous?.choir),
    refresh<Awaited<ReturnType<typeof fetchPracticeEntries>>>('practice', async () => (await fetchPracticeEntries()).map(({ attachments, customAttachments, parts, vocalParts, ...row }) => ({
      ...row,
      vocalParts: (vocalParts?.length ? vocalParts : parts ?? []).map(({ audioUrl, urlOrData, ...part }) => part),
      customAttachments: (customAttachments ?? attachments ?? [])
        .filter(track => track.type === 'audio' || track.type === 'link')
        .filter(track => !/youtu(?:be\.com|\.be)/i.test(track.url || track.urlOrData || ''))
        .map(({ url, urlOrData, ...track }) => track),
    })), previous?.practice),
    refresh('outlines', async () => (await loadSermons()).map(({ attachments, ...row }) => row), previous?.outlines),
    refresh('notes', () => loadNotes(userId), previous?.notes),
  ]);
  return { birthdays, anniversaries, visitors, recognitions, songNumbers, choir, practice, outlines, notes };
}

interface TextSections {
  birthdays?: Awaited<ReturnType<typeof fetchBirthdays>>;
  anniversaries?: Awaited<ReturnType<typeof fetchAnniversaries>>;
  visitors?: Awaited<ReturnType<typeof fetchVisitors>>;
  recognitions?: Awaited<ReturnType<typeof fetchSpecialRecognitions>>;
  songNumbers?: Awaited<ReturnType<typeof fetchSpecialNumbers>>;
  choir?: Awaited<ReturnType<typeof fetchChoirEntries>>;
  practice?: Awaited<ReturnType<typeof fetchPracticeEntries>>;
  outlines?: Awaited<ReturnType<typeof loadSermons>>;
  notes?: Awaited<ReturnType<typeof loadNotes>>;
}

export interface OfflineLibrary {
  user: OfflineAccount;
  songs: Song[];
  setlists: Setlist[];
  activities: ChurchActivity[];
  text?: TextSections;
}

export async function readOfflineLibrary(): Promise<OfflineLibrary | null> {
  if (!isAndroidOfflineLibrary()) return null;
  try {
    const result = await library.read();
    if (!result?.value) return null;
    const value = JSON.parse(result.value) as OfflineLibrary;
    if (value.user?.id && value.user.username && Array.isArray(value.songs)
      && Array.isArray(value.setlists) && Array.isArray(value.activities)) return value;
  } catch (error) {
    console.warn('Offline library could not be opened', error);
  }
  return null;
}

let latestSync = 0;

export async function writeOfflineLibrary(user: OfflineAccount, songs: Song[], setlists: Setlist[], activities: ChurchActivity[], isCurrent: () => boolean) {
  if (!isCurrent()) return;
  const sync = ++latestSync;
  const previous = await readOfflineLibrary();
  if (!isCurrent()) return;
  const text = await fetchTextSections(user.id, previous?.user.id === user.id ? previous.text : undefined);
  if (sync !== latestSync || !isCurrent()) return;
  const { id, username, displayName } = user;
  const textSongs = songs.map(({ attachments, minusOneLink, minus_one_link, ...song }) => song);
  await library.write({ value: JSON.stringify({ user: { id, username, displayName }, songs: textSongs, setlists, activities, text }) });
}

export const clearOfflineLibrary = () => isAndroidOfflineLibrary() ? library.clear() : Promise.resolve();
