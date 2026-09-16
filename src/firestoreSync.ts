import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  Setlist,
  Song,
  BirthdayCelebrant,
  AnniversaryCelebrant,
  Visitor,
  SpecialRecognition,
  SpecialNumberEntry,
  PracticeGroupEntry,
  ChoirEntry,
  UserAccount,
} from './types';
import { DEFAULT_ADMIN } from './utils/storage';

export const COLLECTIONS = {
  SETLISTS: 'setlists',
  SONGS: 'songs',
  BIRTHDAYS: 'birthdays',
  ANNIVERSARIES: 'anniversaries',
  VISITORS: 'visitors',
  SPECIAL_RECOGNITIONS: 'special_recognitions',
  SPECIAL_NUMBERS: 'special_numbers',
  CHOIR_ENTRIES: 'choir_entries',
  PRACTICE_ENTRIES: 'practice_entries',
  SAVED_NAMES: 'saved_names',
  WELCOME_SONGS: 'welcome_songs',
  APP_SETTINGS: 'app_settings',
  USERS: 'users',
} as const;

export type FirestoreConnectionStatus = 'online' | 'offline';

export interface CollectionSyncLogEntry {
  collection: string;
  displayName: string;
  lastSyncTimestamp: number | null;
  itemCount: number;
  status: 'synced' | 'syncing' | 'error' | 'pending';
}

export interface FirestoreStatusInfo {
  status: FirestoreConnectionStatus;
  errorMessage?: string;
  databaseUrl: string;
  collectionLogs: Record<string, CollectionSyncLogEntry>;
  lastGlobalSyncTime: number | null;
  pendingQueueCount: number;
}

const COLLECTION_DISPLAY_NAMES: Record<string, string> = {
  setlists: 'Sunday Services & Setlists',
  songs: 'Song Lyrics & Catalog',
  birthdays: 'Birthday Celebrants',
  anniversaries: 'Anniversary Celebrants',
  visitors: 'Sunday Visitors',
  special_recognitions: 'Special Recognitions',
  special_numbers: 'Special Numbers & Solos',
  choir_entries: 'Choir Group Rosters',
  practice_entries: 'Practice Sessions & Tracks',
  users: 'User Accounts & Roles',
  app_settings: 'Directory Names & Settings',
  saved_names: 'Church Directory Names',
  welcome_songs: 'Welcome Songs',
};

const collectionSyncLogs: Record<string, CollectionSyncLogEntry> = {
  setlists: { collection: 'setlists', displayName: 'Sunday Services & Setlists', lastSyncTimestamp: null, itemCount: 0, status: 'pending' },
  songs: { collection: 'songs', displayName: 'Song Lyrics & Catalog', lastSyncTimestamp: null, itemCount: 0, status: 'pending' },
  birthdays: { collection: 'birthdays', displayName: 'Birthday Celebrants', lastSyncTimestamp: null, itemCount: 0, status: 'pending' },
  anniversaries: { collection: 'anniversaries', displayName: 'Anniversary Celebrants', lastSyncTimestamp: null, itemCount: 0, status: 'pending' },
  visitors: { collection: 'visitors', displayName: 'Sunday Visitors', lastSyncTimestamp: null, itemCount: 0, status: 'pending' },
  special_recognitions: { collection: 'special_recognitions', displayName: 'Special Recognitions', lastSyncTimestamp: null, itemCount: 0, status: 'pending' },
  special_numbers: { collection: 'special_numbers', displayName: 'Special Numbers & Solos', lastSyncTimestamp: null, itemCount: 0, status: 'pending' },
  choir_entries: { collection: 'choir_entries', displayName: 'Choir Group Rosters', lastSyncTimestamp: null, itemCount: 0, status: 'pending' },
  practice_entries: { collection: 'practice_entries', displayName: 'Practice Sessions & Tracks', lastSyncTimestamp: null, itemCount: 0, status: 'pending' },
  users: { collection: 'users', displayName: 'User Accounts & Roles', lastSyncTimestamp: null, itemCount: 0, status: 'pending' },
  app_settings: { collection: 'app_settings', displayName: 'Directory Names & Settings', lastSyncTimestamp: null, itemCount: 0, status: 'pending' },
};

let currentStatus: FirestoreConnectionStatus = 'online';
let lastErrorMessage: string | undefined = undefined;
let lastGlobalSyncTime: number | null = null;
const statusListeners = new Set<(status: FirestoreStatusInfo) => void>();

function notifyStatusChange() {
  const info = getFirestoreConnectionStatus();
  statusListeners.forEach((listener) => {
    try {
      listener(info);
    } catch {
      // ignore
    }
  });
}

export function subscribeToFirestoreStatus(callback: (status: FirestoreStatusInfo) => void): () => void {
  statusListeners.add(callback);
  callback(getFirestoreConnectionStatus());
  return () => {
    statusListeners.delete(callback);
  };
}

export function getFirestoreConnectionStatus(): FirestoreStatusInfo {
  return {
    status: currentStatus,
    errorMessage: lastErrorMessage,
    databaseUrl: 'https://console.firebase.google.com/',
    collectionLogs: { ...collectionSyncLogs },
    lastGlobalSyncTime,
    pendingQueueCount: 0,
  };
}

function updateCollectionLog(colName: string, count: number, status: 'synced' | 'error' | 'syncing') {
  if (collectionSyncLogs[colName]) {
    collectionSyncLogs[colName].itemCount = count;
    collectionSyncLogs[colName].status = status;
    collectionSyncLogs[colName].lastSyncTimestamp = Date.now();
  }
  lastGlobalSyncTime = Date.now();
  currentStatus = 'online';
  notifyStatusChange();
}

/**
 * Direct real-time listener on authoritative Firestore collection
 */
export function subscribeToCollection<T extends { id: string }>(
  collectionName: string,
  onData: (items: T[]) => void,
  onError?: (err: any) => void
): () => void {
  try {
    const colRef = collection(db, collectionName);
    const unsub = onSnapshot(
      colRef,
      (snapshot) => {
        const items: T[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ ...(docSnap.data() as T), id: docSnap.id });
        });
        updateCollectionLog(collectionName, items.length, 'synced');
        onData(items);
      },
      (error) => {
        console.warn(`[Firestore] Subscription error for ${collectionName}:`, error);
        currentStatus = 'offline';
        lastErrorMessage = error.message;
        if (collectionSyncLogs[collectionName]) {
          collectionSyncLogs[collectionName].status = 'error';
        }
        notifyStatusChange();
        if (onError) onError(error);
      }
    );
    return unsub;
  } catch (err) {
    console.warn(`[Firestore] Failed to attach listener for ${collectionName}:`, err);
    return () => {};
  }
}

/**
 * App settings real-time listener (saved names, welcome songs)
 */
export function subscribeToAppSettings(
  onNamesUpdate?: (names: string[]) => void,
  onWelcomeSongsUpdate?: (songs: string[]) => void
): () => void {
  try {
    const colRef = collection(db, COLLECTIONS.APP_SETTINGS);
    const unsub = onSnapshot(
      colRef,
      (snapshot) => {
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (docSnap.id === 'directory_names' && Array.isArray(data.list) && onNamesUpdate) {
            onNamesUpdate(data.list);
          }
          if (docSnap.id === 'welcome_songs' && Array.isArray(data.list) && onWelcomeSongsUpdate) {
            onWelcomeSongsUpdate(data.list);
          }
        });
      },
      () => {}
    );
    return unsub;
  } catch {
    return () => {};
  }
}

// -----------------------------------------------------------------------------
// Direct Authoritative Firestore Document Operations (No Queues, No Resurrections)
// -----------------------------------------------------------------------------

export async function syncSaveSong(song: Song): Promise<void> {
  const ref = doc(db, COLLECTIONS.SONGS, song.id);
  await setDoc(ref, song);
}

export async function syncDeleteSong(id: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.SONGS, id);
  await deleteDoc(ref);
}

export async function syncSaveSetlist(setlist: Setlist): Promise<void> {
  const ref = doc(db, COLLECTIONS.SETLISTS, setlist.id);
  await setDoc(ref, setlist);
}

export async function syncDeleteSetlist(id: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.SETLISTS, id);
  await deleteDoc(ref);
}

export async function syncSaveSpecialNumber(entry: SpecialNumberEntry): Promise<void> {
  const ref = doc(db, COLLECTIONS.SPECIAL_NUMBERS, entry.id);
  await setDoc(ref, entry);
}

export async function syncDeleteSpecialNumber(id: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.SPECIAL_NUMBERS, id);
  await deleteDoc(ref);
}

export async function syncSavePracticeEntry(entry: PracticeGroupEntry): Promise<void> {
  const ref = doc(db, COLLECTIONS.PRACTICE_ENTRIES, entry.id);
  await setDoc(ref, entry);
}

export async function syncDeletePracticeEntry(id: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.PRACTICE_ENTRIES, id);
  await deleteDoc(ref);
}

export async function syncSaveChoirEntry(entry: ChoirEntry): Promise<void> {
  const ref = doc(db, COLLECTIONS.CHOIR_ENTRIES, entry.id);
  await setDoc(ref, entry);
}

export async function syncDeleteChoirEntry(id: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.CHOIR_ENTRIES, id);
  await deleteDoc(ref);
}

export async function syncSaveBirthday(item: BirthdayCelebrant): Promise<void> {
  const ref = doc(db, COLLECTIONS.BIRTHDAYS, item.id);
  await setDoc(ref, item);
}

export async function syncDeleteBirthday(id: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.BIRTHDAYS, id);
  await deleteDoc(ref);
}

export async function syncSaveAnniversary(item: AnniversaryCelebrant): Promise<void> {
  const ref = doc(db, COLLECTIONS.ANNIVERSARIES, item.id);
  await setDoc(ref, item);
}

export async function syncDeleteAnniversary(id: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.ANNIVERSARIES, id);
  await deleteDoc(ref);
}

export async function syncSaveVisitor(item: Visitor): Promise<void> {
  const ref = doc(db, COLLECTIONS.VISITORS, item.id);
  await setDoc(ref, item);
}

export async function syncDeleteVisitor(id: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.VISITORS, id);
  await deleteDoc(ref);
}

export async function syncSaveSpecialRecognition(item: SpecialRecognition): Promise<void> {
  const ref = doc(db, COLLECTIONS.SPECIAL_RECOGNITIONS, item.id);
  await setDoc(ref, item);
}

export async function syncDeleteSpecialRecognition(id: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.SPECIAL_RECOGNITIONS, id);
  await deleteDoc(ref);
}

export async function syncSaveSavedNames(names: string[]): Promise<void> {
  const ref = doc(db, COLLECTIONS.APP_SETTINGS, 'directory_names');
  await setDoc(ref, { id: 'directory_names', list: names, updatedAt: new Date().toISOString() });
}

export async function syncSaveWelcomeSongs(songs: string[]): Promise<void> {
  const ref = doc(db, COLLECTIONS.APP_SETTINGS, 'welcome_songs');
  await setDoc(ref, { id: 'welcome_songs', list: songs, updatedAt: new Date().toISOString() });
}

export async function syncSaveUser(user: UserAccount): Promise<void> {
  const ref = doc(db, COLLECTIONS.USERS, user.id);
  await setDoc(ref, user);
}

export async function syncDeleteUser(id: string): Promise<void> {
  const ref = doc(db, COLLECTIONS.USERS, id);
  await deleteDoc(ref);
}

export async function syncDeleteAllNonAdminUsers(): Promise<void> {
  const usersCol = collection(db, COLLECTIONS.USERS);
  const snap = await getDocs(usersCol);
  for (const d of snap.docs) {
    const data = d.data() as Partial<UserAccount>;
    const isRootAdmin =
      d.id === DEFAULT_ADMIN.id ||
      d.id.toLowerCase() === DEFAULT_ADMIN.username.toLowerCase() ||
      (data.username && data.username.toLowerCase() === DEFAULT_ADMIN.username.toLowerCase()) ||
      data.role === 'admin';

    if (!isRootAdmin) {
      await deleteDoc(doc(db, COLLECTIONS.USERS, d.id)).catch(() => {});
    }
  }
  // Ensure default admin document is securely written
  await setDoc(doc(db, COLLECTIONS.USERS, DEFAULT_ADMIN.id), DEFAULT_ADMIN);
}

/**
 * Import a full backup directly into Firestore using writeBatch chunks of 450
 */
export async function syncBatchImportToFirestore(data: {
  songs?: Song[];
  setlists?: Setlist[];
  birthdays?: BirthdayCelebrant[];
  anniversaries?: AnniversaryCelebrant[];
  visitors?: Visitor[];
  specialRecognitions?: SpecialRecognition[];
  specialNumbers?: SpecialNumberEntry[];
  choirEntries?: ChoirEntry[];
  practiceEntries?: PracticeGroupEntry[];
  savedNames?: string[];
  welcomeSongs?: string[];
}): Promise<{ success: boolean; message: string }> {
  try {
    let totalWritten = 0;
    const itemsToWrite: { col: string; id: string; data: any }[] = [];

    (data.songs || []).forEach((s) => itemsToWrite.push({ col: COLLECTIONS.SONGS, id: s.id, data: s }));
    (data.setlists || []).forEach((s) => itemsToWrite.push({ col: COLLECTIONS.SETLISTS, id: s.id, data: s }));
    (data.birthdays || []).forEach((b) => itemsToWrite.push({ col: COLLECTIONS.BIRTHDAYS, id: b.id, data: b }));
    (data.anniversaries || []).forEach((a) => itemsToWrite.push({ col: COLLECTIONS.ANNIVERSARIES, id: a.id, data: a }));
    (data.visitors || []).forEach((v) => itemsToWrite.push({ col: COLLECTIONS.VISITORS, id: v.id, data: v }));
    (data.specialRecognitions || []).forEach((r) => itemsToWrite.push({ col: COLLECTIONS.SPECIAL_RECOGNITIONS, id: r.id, data: r }));
    (data.specialNumbers || []).forEach((sn) => itemsToWrite.push({ col: COLLECTIONS.SPECIAL_NUMBERS, id: sn.id, data: sn }));
    (data.choirEntries || []).forEach((c) => itemsToWrite.push({ col: COLLECTIONS.CHOIR_ENTRIES, id: c.id, data: c }));
    (data.practiceEntries || []).forEach((p) => itemsToWrite.push({ col: COLLECTIONS.PRACTICE_ENTRIES, id: p.id, data: p }));

    if (data.savedNames) {
      itemsToWrite.push({
        col: COLLECTIONS.APP_SETTINGS,
        id: 'directory_names',
        data: { id: 'directory_names', list: data.savedNames, updatedAt: new Date().toISOString() },
      });
    }

    if (data.welcomeSongs) {
      itemsToWrite.push({
        col: COLLECTIONS.APP_SETTINGS,
        id: 'welcome_songs',
        data: { id: 'welcome_songs', list: data.welcomeSongs, updatedAt: new Date().toISOString() },
      });
    }

    // Chunk into 400 operations per batch (Firestore limit is 500)
    for (let i = 0; i < itemsToWrite.length; i += 400) {
      const chunk = itemsToWrite.slice(i, i + 400);
      const batch = writeBatch(db);
      for (const item of chunk) {
        batch.set(doc(db, item.col, item.id), item.data);
      }
      await batch.commit();
      totalWritten += chunk.length;
    }

    return {
      success: true,
      message: `Successfully synchronized ${totalWritten} records to Firestore Cloud.`,
    };
  } catch (err: any) {
    console.error('[Firestore] Batch import error:', err);
    return {
      success: false,
      message: 'Batch import error: ' + (err.message || String(err)),
    };
  }
}

/**
 * Complete database reset across all church data collections
 */
export async function resetFirestoreDatabase(): Promise<{ success: boolean; message: string }> {
  try {
    const collectionsToClean = [
      COLLECTIONS.SONGS,
      COLLECTIONS.SETLISTS,
      COLLECTIONS.SPECIAL_NUMBERS,
      COLLECTIONS.PRACTICE_ENTRIES,
      COLLECTIONS.CHOIR_ENTRIES,
      COLLECTIONS.BIRTHDAYS,
      COLLECTIONS.ANNIVERSARIES,
      COLLECTIONS.VISITORS,
      COLLECTIONS.SPECIAL_RECOGNITIONS,
      COLLECTIONS.APP_SETTINGS,
    ];

    for (const col of collectionsToClean) {
      const snap = await getDocs(collection(db, col));
      for (const d of snap.docs) {
        await deleteDoc(d.ref).catch(() => {});
      }
    }

    // Reset users to Admin only
    await syncDeleteAllNonAdminUsers();

    return { success: true, message: 'All church database records have been deleted in Firestore.' };
  } catch (err: any) {
    return { success: false, message: 'Reset failed: ' + err.message };
  }
}
