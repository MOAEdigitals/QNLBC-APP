import { Capacitor, registerPlugin } from '@capacitor/core';
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

export interface OfflineLibrary {
  user: OfflineAccount;
  songs: Song[];
  setlists: Setlist[];
  activities: ChurchActivity[];
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

export async function writeOfflineLibrary(user: OfflineAccount, songs: Song[], setlists: Setlist[], activities: ChurchActivity[]) {
  const { id, username, displayName } = user;
  const textSongs = songs.map(({ attachments, minusOneLink, minus_one_link, ...song }) => song);
  await library.write({ value: JSON.stringify({ user: { id, username, displayName }, songs: textSongs, setlists, activities }) });
}

export const clearOfflineLibrary = () => isAndroidOfflineLibrary() ? library.clear() : Promise.resolve();
