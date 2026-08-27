import {
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  limit,
  query,
} from 'firebase/firestore';
import { db } from './firebase';
import firebaseConfig from '../firebase-applet-config.json';
import {
  Setlist,
  Song,
  BirthdayCelebrant,
  AnniversaryCelebrant,
  Visitor,
  SpecialRecognition,
  SpecialNumberEntry,
  PracticeGroupEntry,
  UserAccount,
} from './types';
import {
  loadSetlists,
  loadSongs,
  loadBirthdays,
  loadAnniversaries,
  loadVisitors,
  loadSpecialRecognitions,
  loadSpecialNumbers,
  loadPracticeEntries,
  loadSavedNames,
  loadWelcomeSongs,
  loadUsers,
} from './utils/storage';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export type FirestoreConnectionStatus = 'online' | 'offline' | 'quota-exceeded';

export interface FirestoreStatusInfo {
  status: FirestoreConnectionStatus;
  errorMessage?: string;
  quotaResetMessage?: string;
  databaseUrl: string;
}

const COLLECTIONS = {
  SETLISTS: 'setlists',
  SONGS: 'songs',
  BIRTHDAYS: 'birthdays',
  ANNIVERSARIES: 'anniversaries',
  VISITORS: 'visitors',
  SPECIAL_RECOGNITIONS: 'special_recognitions',
  SPECIAL_NUMBERS: 'special_numbers',
  PRACTICE_ENTRIES: 'practice_entries',
  SAVED_NAMES: 'saved_names',
  WELCOME_SONGS: 'welcome_songs',
  PRACTICE_AUDIOS: 'practice_audios',
  APP_SETTINGS: 'app_settings',
  USERS: 'users',
};

// Global state for connection & quota tracking
let isQuotaExhausted = false;
let currentStatus: FirestoreConnectionStatus = 'online';
let lastErrorMessage = '';
const statusListeners = new Set<(status: FirestoreStatusInfo) => void>();

// Check local storage for previously recorded quota exhaustion for today
const QUOTA_STORAGE_KEY = 'nlbc_firestore_quota_exhausted_date';
try {
  const todayStr = new Date().toISOString().split('T')[0];
  const savedDate = localStorage.getItem(QUOTA_STORAGE_KEY);
  if (savedDate === todayStr) {
    isQuotaExhausted = true;
    currentStatus = 'quota-exceeded';
  }
} catch {
  // ignore
}

export function subscribeToFirestoreStatus(listener: (status: FirestoreStatusInfo) => void): () => void {
  statusListeners.add(listener);
  listener(getFirestoreConnectionStatus());
  return () => {
    statusListeners.delete(listener);
  };
}

function notifyStatusChange() {
  const info = getFirestoreConnectionStatus();
  statusListeners.forEach((l) => {
    try {
      l(info);
    } catch {
      // ignore listener error
    }
  });
}

export function isFirestoreQuotaExhausted(): boolean {
  return isQuotaExhausted;
}

export function getFirestoreConnectionStatus(): FirestoreStatusInfo {
  const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
  const projectId = firebaseConfig.projectId || '';
  const databaseUrl = `https://console.firebase.google.com/project/${projectId}/firestore/databases/${databaseId}/data?openUpgradeDialog=true`;

  return {
    status: currentStatus,
    errorMessage: lastErrorMessage,
    databaseUrl,
    quotaResetMessage:
      'Firestore daily free write quota has been reached for today. The application is operating seamlessly in local offline storage mode. All changes, songs, setlists, and recordings are safely preserved on this device and will sync once the daily quota resets.',
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): void {
  const rawMsg = error instanceof Error ? error.message : String(error);
  const isQuota =
    rawMsg.includes('resource-exhausted') ||
    rawMsg.includes('Quota limit exceeded') ||
    rawMsg.includes('Free daily write units') ||
    rawMsg.includes('quota metric');

  const isOffline =
    rawMsg.includes('unavailable') ||
    rawMsg.includes('offline') ||
    rawMsg.includes('Could not reach Cloud Firestore backend');

  lastErrorMessage = rawMsg;

  if (isQuota) {
    isQuotaExhausted = true;
    currentStatus = 'quota-exceeded';
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      localStorage.setItem(QUOTA_STORAGE_KEY, todayStr);
    } catch {
      // ignore
    }
    notifyStatusChange();
    console.warn(
      `[Firestore Notice] Daily write quota reached. Switched to offline local persistence mode.`
    );
  } else if (isOffline && currentStatus !== 'quota-exceeded') {
    currentStatus = 'offline';
    notifyStatusChange();
  }

  const errInfo: FirestoreErrorInfo = {
    error: rawMsg,
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: [],
    },
    operationType,
    path,
  };

  // Structured log conforming to Firebase skill
  if (isQuota) {
    console.warn('Firestore Quota Info:', JSON.stringify(errInfo));
  } else {
    console.warn('Firestore Connection Notice:', JSON.stringify(errInfo));
  }
}

// Generic recursive sanitize helper to avoid undefined fields and payload limits in Firestore documents
function sanitizeDoc<T>(data: T): Record<string, any> {
  if (data === null || data === undefined) return {} as Record<string, any>;

  const cleanObject = (obj: any): any => {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') {
      // Guard against oversized base64 data URLs in Firestore documents (> 200KB)
      if (typeof obj === 'string' && obj.startsWith('data:') && obj.length > 200000) {
        return 'indexeddb:local_storage';
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj
        .filter((item) => item !== undefined)
        .map((item) => cleanObject(item));
    }

    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        clean[key] = cleanObject(value);
      }
    }
    return clean;
  };

  return cleanObject(data);
}

// Subscribe to real-time updates for any collection
export function subscribeToCollection<T extends { id: string }>(
  collectionName: string,
  onUpdate: (items: T[]) => void
) {
  try {
    const colRef = collection(db, collectionName);
    return onSnapshot(
      colRef,
      (snapshot) => {
        if (currentStatus === 'offline' && !isQuotaExhausted) {
          currentStatus = 'online';
          notifyStatusChange();
        }
        const items: T[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ ...(docSnap.data() as T), id: docSnap.id });
        });
        onUpdate(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, collectionName);
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, collectionName);
    return () => {};
  }
}

// Firestore Write Operations with Quota Circuit-Breaker
export async function syncSaveSetlist(setlist: Setlist): Promise<void> {
  if (isQuotaExhausted) return;
  try {
    const docRef = doc(db, COLLECTIONS.SETLISTS, setlist.id);
    await setDoc(docRef, sanitizeDoc(setlist), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.SETLISTS}/${setlist.id}`);
  }
}

export async function syncDeleteSetlist(id: string): Promise<void> {
  if (isQuotaExhausted) return;
  try {
    await deleteDoc(doc(db, COLLECTIONS.SETLISTS, id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.SETLISTS}/${id}`);
  }
}

export async function syncSaveSong(song: Song): Promise<void> {
  if (isQuotaExhausted) return;
  try {
    const docRef = doc(db, COLLECTIONS.SONGS, song.id);
    await setDoc(docRef, sanitizeDoc(song), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.SONGS}/${song.id}`);
  }
}

export async function syncDeleteSong(id: string): Promise<void> {
  if (isQuotaExhausted) return;
  try {
    await deleteDoc(doc(db, COLLECTIONS.SONGS, id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.SONGS}/${id}`);
  }
}

export async function syncSaveSpecialNumber(entry: SpecialNumberEntry): Promise<void> {
  if (isQuotaExhausted) return;
  try {
    const docRef = doc(db, COLLECTIONS.SPECIAL_NUMBERS, entry.id);
    await setDoc(docRef, sanitizeDoc(entry), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.SPECIAL_NUMBERS}/${entry.id}`);
  }
}

export async function syncDeleteSpecialNumber(id: string): Promise<void> {
  if (isQuotaExhausted) return;
  try {
    await deleteDoc(doc(db, COLLECTIONS.SPECIAL_NUMBERS, id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.SPECIAL_NUMBERS}/${id}`);
  }
}

export async function syncSavePracticeEntry(entry: PracticeGroupEntry): Promise<void> {
  if (isQuotaExhausted) return;
  try {
    const docRef = doc(db, COLLECTIONS.PRACTICE_ENTRIES, entry.id);
    await setDoc(docRef, sanitizeDoc(entry), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.PRACTICE_ENTRIES}/${entry.id}`);
  }
}

export async function syncDeletePracticeEntry(id: string): Promise<void> {
  if (isQuotaExhausted) return;
  try {
    await deleteDoc(doc(db, COLLECTIONS.PRACTICE_ENTRIES, id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.PRACTICE_ENTRIES}/${id}`);
  }
}

export async function syncSaveBirthday(item: BirthdayCelebrant): Promise<void> {
  if (isQuotaExhausted) return;
  try {
    const docRef = doc(db, COLLECTIONS.BIRTHDAYS, item.id);
    await setDoc(docRef, sanitizeDoc(item), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.BIRTHDAYS}/${item.id}`);
  }
}

export async function syncDeleteBirthday(id: string): Promise<void> {
  if (isQuotaExhausted) return;
  try {
    await deleteDoc(doc(db, COLLECTIONS.BIRTHDAYS, id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.BIRTHDAYS}/${id}`);
  }
}

export async function syncSaveAnniversary(item: AnniversaryCelebrant): Promise<void> {
  if (isQuotaExhausted) return;
  try {
    const docRef = doc(db, COLLECTIONS.ANNIVERSARIES, item.id);
    await setDoc(docRef, sanitizeDoc(item), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.ANNIVERSARIES}/${item.id}`);
  }
}

export async function syncDeleteAnniversary(id: string): Promise<void> {
  if (isQuotaExhausted) return;
  try {
    await deleteDoc(doc(db, COLLECTIONS.ANNIVERSARIES, id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.ANNIVERSARIES}/${id}`);
  }
}

export async function syncSaveVisitor(item: Visitor): Promise<void> {
  if (isQuotaExhausted) return;
  try {
    const docRef = doc(db, COLLECTIONS.VISITORS, item.id);
    await setDoc(docRef, sanitizeDoc(item), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.VISITORS}/${item.id}`);
  }
}

export async function syncDeleteVisitor(id: string): Promise<void> {
  if (isQuotaExhausted) return;
  try {
    await deleteDoc(doc(db, COLLECTIONS.VISITORS, id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.VISITORS}/${id}`);
  }
}

export async function syncSaveSpecialRecognition(item: SpecialRecognition): Promise<void> {
  if (isQuotaExhausted) return;
  try {
    const docRef = doc(db, COLLECTIONS.SPECIAL_RECOGNITIONS, item.id);
    await setDoc(docRef, sanitizeDoc(item), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.SPECIAL_RECOGNITIONS}/${item.id}`);
  }
}

export async function syncDeleteSpecialRecognition(id: string): Promise<void> {
  if (isQuotaExhausted) return;
  try {
    await deleteDoc(doc(db, COLLECTIONS.SPECIAL_RECOGNITIONS, id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.SPECIAL_RECOGNITIONS}/${id}`);
  }
}

export async function syncSaveUser(user: UserAccount): Promise<void> {
  if (isQuotaExhausted) return;
  try {
    const docRef = doc(db, COLLECTIONS.USERS, user.id);
    await setDoc(docRef, sanitizeDoc(user), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.USERS}/${user.id}`);
  }
}

export async function syncDeleteUser(id: string, username?: string): Promise<void> {
  if (isQuotaExhausted) return;
  try {
    if (id) {
      await deleteDoc(doc(db, COLLECTIONS.USERS, id));
    }
    if (username) {
      const usersCol = collection(db, COLLECTIONS.USERS);
      const snap = await getDocs(usersCol);
      for (const d of snap.docs) {
        const data = d.data();
        if (
          d.id === id ||
          d.id.toLowerCase() === username.toLowerCase() ||
          (data.username && data.username.toLowerCase() === username.toLowerCase())
        ) {
          await deleteDoc(doc(db, COLLECTIONS.USERS, d.id));
        }
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.USERS}/${id}`);
  }
}

// --- Practice Audio Cloud Sync (Cross-Device Audio Stem & Voice Memo Sync) ---
const MAX_CHUNK_SIZE = 700000; // 700KB chunk size to stay safely within Firestore 1MB document limit

export async function syncSavePracticeAudio(id: string, dataUrl: string, title?: string): Promise<void> {
  if (isQuotaExhausted || !id || !dataUrl) return;
  const cleanId = id.replace(/^indexeddb:/, '');

  try {
    if (dataUrl.length <= MAX_CHUNK_SIZE) {
      const docRef = doc(db, COLLECTIONS.PRACTICE_AUDIOS, cleanId);
      await setDoc(
        docRef,
        {
          id: cleanId,
          dataUrl,
          title: title || '',
          isChunked: false,
          size: dataUrl.length,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } else {
      const totalChunks = Math.ceil(dataUrl.length / MAX_CHUNK_SIZE);
      const docRef = doc(db, COLLECTIONS.PRACTICE_AUDIOS, cleanId);
      await setDoc(
        docRef,
        {
          id: cleanId,
          title: title || '',
          isChunked: true,
          totalChunks,
          size: dataUrl.length,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      for (let i = 0; i < totalChunks; i++) {
        const chunk = dataUrl.substring(i * MAX_CHUNK_SIZE, (i + 1) * MAX_CHUNK_SIZE);
        const chunkDocRef = doc(db, COLLECTIONS.PRACTICE_AUDIOS, `${cleanId}_chunk_${i}`);
        await setDoc(chunkDocRef, { chunkIndex: i, data: chunk, parentId: cleanId });
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.PRACTICE_AUDIOS}/${cleanId}`);
  }
}

export async function fetchPracticeAudioFromCloud(id: string): Promise<string | null> {
  if (!id) return null;
  const cleanId = id.replace(/^indexeddb:/, '');

  try {
    const docRef = doc(db, COLLECTIONS.PRACTICE_AUDIOS, cleanId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;

    const data = docSnap.data();
    if (!data.isChunked && data.dataUrl) {
      return data.dataUrl;
    }

    if (data.isChunked && data.totalChunks) {
      let combined = '';
      for (let i = 0; i < data.totalChunks; i++) {
        const chunkDocRef = doc(db, COLLECTIONS.PRACTICE_AUDIOS, `${cleanId}_chunk_${i}`);
        const chunkSnap = await getDoc(chunkDocRef);
        if (chunkSnap.exists() && chunkSnap.data().data) {
          combined += chunkSnap.data().data;
        } else {
          return null; // Missing chunk
        }
      }
      return combined || null;
    }

    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `${COLLECTIONS.PRACTICE_AUDIOS}/${cleanId}`);
    return null;
  }
}

export async function syncDeletePracticeAudio(id: string): Promise<void> {
  if (isQuotaExhausted || !id) return;
  const cleanId = id.replace(/^indexeddb:/, '');

  try {
    const docRef = doc(db, COLLECTIONS.PRACTICE_AUDIOS, cleanId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.isChunked && data.totalChunks) {
        for (let i = 0; i < data.totalChunks; i++) {
          await deleteDoc(doc(db, COLLECTIONS.PRACTICE_AUDIOS, `${cleanId}_chunk_${i}`));
        }
      }
      await deleteDoc(docRef);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.PRACTICE_AUDIOS}/${cleanId}`);
  }
}

export function subscribeToPracticeAudios(
  onAudioUpdated: (audioId: string, dataUrl: string) => void
) {
  try {
    const colRef = collection(db, COLLECTIONS.PRACTICE_AUDIOS);
    return onSnapshot(
      colRef,
      (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const data = change.doc.data();
            const docId = change.doc.id;
            // Skip internal child chunk documents
            if (docId.includes('_chunk_') || data.chunkIndex !== undefined) {
              return;
            }

            if (!data.isChunked && data.dataUrl) {
              onAudioUpdated(docId, data.dataUrl);
            } else if (data.isChunked) {
              const fullData = await fetchPracticeAudioFromCloud(docId);
              if (fullData) {
                onAudioUpdated(docId, fullData);
              }
            }
          }
        });
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, COLLECTIONS.PRACTICE_AUDIOS);
      }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.PRACTICE_AUDIOS);
    return () => {};
  }
}

// --- Settings Cloud Sync (Church Directory & Welcome Songs) ---

export async function syncSaveSavedNames(names: string[]): Promise<void> {
  if (isQuotaExhausted) return;
  try {
    const docRef = doc(db, COLLECTIONS.APP_SETTINGS, 'saved_names');
    await setDoc(docRef, { id: 'saved_names', names, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.APP_SETTINGS}/saved_names`);
  }
}

export async function syncSaveWelcomeSongs(songs: string[]): Promise<void> {
  if (isQuotaExhausted) return;
  try {
    const docRef = doc(db, COLLECTIONS.APP_SETTINGS, 'welcome_songs');
    await setDoc(docRef, { id: 'welcome_songs', songs, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.APP_SETTINGS}/welcome_songs`);
  }
}

export function subscribeToAppSettings(
  onUpdateSavedNames: (names: string[]) => void,
  onUpdateWelcomeSongs: (songs: string[]) => void
) {
  try {
    const namesDocRef = doc(db, COLLECTIONS.APP_SETTINGS, 'saved_names');
    const songsDocRef = doc(db, COLLECTIONS.APP_SETTINGS, 'welcome_songs');

    const unsubNames = onSnapshot(
      namesDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.names)) {
            onUpdateSavedNames(data.names);
          }
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `${COLLECTIONS.APP_SETTINGS}/saved_names`)
    );

    const unsubSongs = onSnapshot(
      songsDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.songs)) {
            onUpdateWelcomeSongs(data.songs);
          }
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `${COLLECTIONS.APP_SETTINGS}/welcome_songs`)
    );

    return () => {
      unsubNames();
      unsubSongs();
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, COLLECTIONS.APP_SETTINGS);
    return () => {};
  }
}

const SEED_STORAGE_FLAG = 'nlbc_firestore_cloud_seeded_v3';

/**
 * Initial Cloud Seeding:
 * Guarded against repeated loops and quota exhaustion. Runs once per project client instance.
 */
export async function initializeFirestoreCloudSeed(): Promise<void> {
  if (isQuotaExhausted) return;

  try {
    if (localStorage.getItem(SEED_STORAGE_FLAG) === 'true') {
      return;
    }

    // Light check: query just 1 song document to see if DB is already populated
    const songsQuery = query(collection(db, COLLECTIONS.SONGS), limit(1));
    const songsSnap = await getDocs(songsQuery);

    if (!songsSnap.empty) {
      // Database is already populated by another device/session
      localStorage.setItem(SEED_STORAGE_FLAG, 'true');
      return;
    }

    // Otherwise, seed initial dataset gently
    const initialSongs = loadSongs();
    for (const s of initialSongs) {
      if (isQuotaExhausted) break;
      await setDoc(doc(db, COLLECTIONS.SONGS, s.id), sanitizeDoc(s), { merge: true });
    }

    const initialSetlists = loadSetlists();
    for (const setlist of initialSetlists) {
      if (isQuotaExhausted) break;
      await setDoc(doc(db, COLLECTIONS.SETLISTS, setlist.id), sanitizeDoc(setlist), { merge: true });
    }

    const initialSpecialNumbers = loadSpecialNumbers();
    for (const sp of initialSpecialNumbers) {
      if (isQuotaExhausted) break;
      await setDoc(doc(db, COLLECTIONS.SPECIAL_NUMBERS, sp.id), sanitizeDoc(sp), { merge: true });
    }

    const initialPractice = loadPracticeEntries();
    for (const pr of initialPractice) {
      if (isQuotaExhausted) break;
      await setDoc(doc(db, COLLECTIONS.PRACTICE_ENTRIES, pr.id), sanitizeDoc(pr), { merge: true });
    }

    const initialBirthdays = loadBirthdays();
    for (const b of initialBirthdays) {
      if (isQuotaExhausted) break;
      await setDoc(doc(db, COLLECTIONS.BIRTHDAYS, b.id), sanitizeDoc(b), { merge: true });
    }

    const initialAnniv = loadAnniversaries();
    for (const a of initialAnniv) {
      if (isQuotaExhausted) break;
      await setDoc(doc(db, COLLECTIONS.ANNIVERSARIES, a.id), sanitizeDoc(a), { merge: true });
    }

    const initialVisitors = loadVisitors();
    for (const v of initialVisitors) {
      if (isQuotaExhausted) break;
      await setDoc(doc(db, COLLECTIONS.VISITORS, v.id), sanitizeDoc(v), { merge: true });
    }

    const initialRecognitions = loadSpecialRecognitions();
    for (const r of initialRecognitions) {
      if (isQuotaExhausted) break;
      await setDoc(doc(db, COLLECTIONS.SPECIAL_RECOGNITIONS, r.id), sanitizeDoc(r), { merge: true });
    }

    const initialUsers = loadUsers();
    for (const u of initialUsers) {
      if (isQuotaExhausted) break;
      await setDoc(doc(db, COLLECTIONS.USERS, u.id), sanitizeDoc(u), { merge: true });
    }

    const initialNames = loadSavedNames();
    await setDoc(doc(db, COLLECTIONS.APP_SETTINGS, 'saved_names'), {
      id: 'saved_names',
      names: initialNames,
      updatedAt: new Date().toISOString(),
    });

    const initialWelcome = loadWelcomeSongs();
    await setDoc(doc(db, COLLECTIONS.APP_SETTINGS, 'welcome_songs'), {
      id: 'welcome_songs',
      songs: initialWelcome,
      updatedAt: new Date().toISOString(),
    });

    localStorage.setItem(SEED_STORAGE_FLAG, 'true');
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'cloud_seed');
    // Mark as checked to prevent hammering on every refresh
    try {
      localStorage.setItem(SEED_STORAGE_FLAG, 'true');
    } catch {
      // ignore
    }
  }
}
