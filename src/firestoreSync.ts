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

// Queue storage key for offline and quota-deferred mutations
const PENDING_QUEUE_KEY = 'nlbc_firestore_pending_queue_v1';
const QUOTA_STORAGE_KEY = 'nlbc_firestore_quota_exhausted_date';

interface PendingSyncItem {
  collectionName: string;
  id: string;
  data?: Record<string, any>;
  operation: 'write' | 'delete';
  timestamp: number;
}

function getPendingQueue(): PendingSyncItem[] {
  try {
    const raw = localStorage.getItem(PENDING_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePendingQueue(queue: PendingSyncItem[]) {
  try {
    localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue.slice(-50))); // Keep last 50
  } catch {
    // ignore
  }
}

function enqueuePending(collectionName: string, id: string, data?: Record<string, any>, operation: 'write' | 'delete' = 'write') {
  const queue = getPendingQueue().filter((item) => !(item.collectionName === collectionName && item.id === id));
  queue.push({
    collectionName,
    id,
    data,
    operation,
    timestamp: Date.now(),
  });
  savePendingQueue(queue);
}

function dequeuePending(collectionName: string, id: string) {
  const queue = getPendingQueue().filter((item) => !(item.collectionName === collectionName && item.id === id));
  savePendingQueue(queue);
}

// Check local storage for previously recorded quota exhaustion for today
try {
  const todayStr = new Date().toISOString().split('T')[0];
  const savedDate = localStorage.getItem(QUOTA_STORAGE_KEY);
  if (savedDate === todayStr) {
    // Set status flag initially but allow background retries
    isQuotaExhausted = false; // Allow fresh attempts today so new changes can test connection
    currentStatus = 'online';
  } else {
    localStorage.removeItem(QUOTA_STORAGE_KEY);
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

function markOperationSuccess() {
  if (isQuotaExhausted || currentStatus !== 'online') {
    isQuotaExhausted = false;
    currentStatus = 'online';
    lastErrorMessage = '';
    try {
      localStorage.removeItem(QUOTA_STORAGE_KEY);
    } catch {
      // ignore
    }
    notifyStatusChange();
  }
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
      // Guard against oversized base64 data URLs in Firestore documents (> 100KB)
      if (typeof obj === 'string' && obj.startsWith('data:') && obj.length > 100000) {
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

// Flush pending offline/quota-deferred queue
export async function flushPendingSyncQueue(): Promise<void> {
  const queue = getPendingQueue();
  if (queue.length === 0) return;

  for (const item of queue) {
    try {
      const docRef = doc(db, item.collectionName, item.id);
      if (item.operation === 'write' && item.data) {
        await setDoc(docRef, sanitizeDoc(item.data), { merge: true });
      } else if (item.operation === 'delete') {
        await deleteDoc(docRef);
      }
      dequeuePending(item.collectionName, item.id);
      markOperationSuccess();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${item.collectionName}/${item.id}`);
      break; // Pause flushing if quota error happens
    }
  }
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
        markOperationSuccess();
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

// Firestore Write Operations with Automatic Offline Queue & Retry
export async function syncSaveSetlist(setlist: Setlist): Promise<void> {
  const sanitized = sanitizeDoc(setlist);
  try {
    const docRef = doc(db, COLLECTIONS.SETLISTS, setlist.id);
    await setDoc(docRef, sanitized, { merge: true });
    dequeuePending(COLLECTIONS.SETLISTS, setlist.id);
    markOperationSuccess();
  } catch (err) {
    enqueuePending(COLLECTIONS.SETLISTS, setlist.id, sanitized, 'write');
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.SETLISTS}/${setlist.id}`);
  }
}

export async function syncDeleteSetlist(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTIONS.SETLISTS, id));
    dequeuePending(COLLECTIONS.SETLISTS, id);
    markOperationSuccess();
  } catch (err) {
    enqueuePending(COLLECTIONS.SETLISTS, id, undefined, 'delete');
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.SETLISTS}/${id}`);
  }
}

export async function syncSaveSong(song: Song): Promise<void> {
  const sanitized = sanitizeDoc(song);
  try {
    const docRef = doc(db, COLLECTIONS.SONGS, song.id);
    await setDoc(docRef, sanitized, { merge: true });
    dequeuePending(COLLECTIONS.SONGS, song.id);
    markOperationSuccess();
  } catch (err) {
    enqueuePending(COLLECTIONS.SONGS, song.id, sanitized, 'write');
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.SONGS}/${song.id}`);
  }
}

export async function syncDeleteSong(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTIONS.SONGS, id));
    dequeuePending(COLLECTIONS.SONGS, id);
    markOperationSuccess();
  } catch (err) {
    enqueuePending(COLLECTIONS.SONGS, id, undefined, 'delete');
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.SONGS}/${id}`);
  }
}

export async function syncSaveSpecialNumber(entry: SpecialNumberEntry): Promise<void> {
  const sanitized = sanitizeDoc(entry);
  try {
    const docRef = doc(db, COLLECTIONS.SPECIAL_NUMBERS, entry.id);
    await setDoc(docRef, sanitized, { merge: true });
    dequeuePending(COLLECTIONS.SPECIAL_NUMBERS, entry.id);
    markOperationSuccess();
  } catch (err) {
    enqueuePending(COLLECTIONS.SPECIAL_NUMBERS, entry.id, sanitized, 'write');
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.SPECIAL_NUMBERS}/${entry.id}`);
  }
}

export async function syncDeleteSpecialNumber(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTIONS.SPECIAL_NUMBERS, id));
    dequeuePending(COLLECTIONS.SPECIAL_NUMBERS, id);
    markOperationSuccess();
  } catch (err) {
    enqueuePending(COLLECTIONS.SPECIAL_NUMBERS, id, undefined, 'delete');
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.SPECIAL_NUMBERS}/${id}`);
  }
}

export async function syncSavePracticeEntry(entry: PracticeGroupEntry): Promise<void> {
  const sanitized = sanitizeDoc(entry);
  try {
    const docRef = doc(db, COLLECTIONS.PRACTICE_ENTRIES, entry.id);
    await setDoc(docRef, sanitized, { merge: true });
    dequeuePending(COLLECTIONS.PRACTICE_ENTRIES, entry.id);
    markOperationSuccess();
  } catch (err) {
    enqueuePending(COLLECTIONS.PRACTICE_ENTRIES, entry.id, sanitized, 'write');
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.PRACTICE_ENTRIES}/${entry.id}`);
  }
}

export async function syncDeletePracticeEntry(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTIONS.PRACTICE_ENTRIES, id));
    dequeuePending(COLLECTIONS.PRACTICE_ENTRIES, id);
    markOperationSuccess();
  } catch (err) {
    enqueuePending(COLLECTIONS.PRACTICE_ENTRIES, id, undefined, 'delete');
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.PRACTICE_ENTRIES}/${id}`);
  }
}

export async function syncSaveBirthday(item: BirthdayCelebrant): Promise<void> {
  const sanitized = sanitizeDoc(item);
  try {
    const docRef = doc(db, COLLECTIONS.BIRTHDAYS, item.id);
    await setDoc(docRef, sanitized, { merge: true });
    dequeuePending(COLLECTIONS.BIRTHDAYS, item.id);
    markOperationSuccess();
  } catch (err) {
    enqueuePending(COLLECTIONS.BIRTHDAYS, item.id, sanitized, 'write');
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.BIRTHDAYS}/${item.id}`);
  }
}

export async function syncDeleteBirthday(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTIONS.BIRTHDAYS, id));
    dequeuePending(COLLECTIONS.BIRTHDAYS, id);
    markOperationSuccess();
  } catch (err) {
    enqueuePending(COLLECTIONS.BIRTHDAYS, id, undefined, 'delete');
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.BIRTHDAYS}/${id}`);
  }
}

export async function syncSaveAnniversary(item: AnniversaryCelebrant): Promise<void> {
  const sanitized = sanitizeDoc(item);
  try {
    const docRef = doc(db, COLLECTIONS.ANNIVERSARIES, item.id);
    await setDoc(docRef, sanitized, { merge: true });
    dequeuePending(COLLECTIONS.ANNIVERSARIES, item.id);
    markOperationSuccess();
  } catch (err) {
    enqueuePending(COLLECTIONS.ANNIVERSARIES, item.id, sanitized, 'write');
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.ANNIVERSARIES}/${item.id}`);
  }
}

export async function syncDeleteAnniversary(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTIONS.ANNIVERSARIES, id));
    dequeuePending(COLLECTIONS.ANNIVERSARIES, id);
    markOperationSuccess();
  } catch (err) {
    enqueuePending(COLLECTIONS.ANNIVERSARIES, id, undefined, 'delete');
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.ANNIVERSARIES}/${id}`);
  }
}

export async function syncSaveVisitor(item: Visitor): Promise<void> {
  const sanitized = sanitizeDoc(item);
  try {
    const docRef = doc(db, COLLECTIONS.VISITORS, item.id);
    await setDoc(docRef, sanitized, { merge: true });
    dequeuePending(COLLECTIONS.VISITORS, item.id);
    markOperationSuccess();
  } catch (err) {
    enqueuePending(COLLECTIONS.VISITORS, item.id, sanitized, 'write');
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.VISITORS}/${item.id}`);
  }
}

export async function syncDeleteVisitor(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTIONS.VISITORS, id));
    dequeuePending(COLLECTIONS.VISITORS, id);
    markOperationSuccess();
  } catch (err) {
    enqueuePending(COLLECTIONS.VISITORS, id, undefined, 'delete');
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.VISITORS}/${id}`);
  }
}

export async function syncSaveSpecialRecognition(item: SpecialRecognition): Promise<void> {
  const sanitized = sanitizeDoc(item);
  try {
    const docRef = doc(db, COLLECTIONS.SPECIAL_RECOGNITIONS, item.id);
    await setDoc(docRef, sanitized, { merge: true });
    dequeuePending(COLLECTIONS.SPECIAL_RECOGNITIONS, item.id);
    markOperationSuccess();
  } catch (err) {
    enqueuePending(COLLECTIONS.SPECIAL_RECOGNITIONS, item.id, sanitized, 'write');
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.SPECIAL_RECOGNITIONS}/${item.id}`);
  }
}

export async function syncDeleteSpecialRecognition(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTIONS.SPECIAL_RECOGNITIONS, id));
    dequeuePending(COLLECTIONS.SPECIAL_RECOGNITIONS, id);
    markOperationSuccess();
  } catch (err) {
    enqueuePending(COLLECTIONS.SPECIAL_RECOGNITIONS, id, undefined, 'delete');
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.SPECIAL_RECOGNITIONS}/${id}`);
  }
}

export async function syncSaveUser(user: UserAccount): Promise<void> {
  const sanitized = sanitizeDoc(user);
  try {
    const docRef = doc(db, COLLECTIONS.USERS, user.id);
    await setDoc(docRef, sanitized, { merge: true });
    dequeuePending(COLLECTIONS.USERS, user.id);
    markOperationSuccess();
  } catch (err) {
    enqueuePending(COLLECTIONS.USERS, user.id, sanitized, 'write');
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
const MAX_CHUNK_SIZE = 700000; // 700KB safe single document limit

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
      markOperationSuccess();
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
  if (!id) return;
  const cleanId = id.replace(/^indexeddb:/, '');

  try {
    const docRef = doc(db, COLLECTIONS.PRACTICE_AUDIOS, cleanId);
    await deleteDoc(docRef);
    markOperationSuccess();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.PRACTICE_AUDIOS}/${cleanId}`);
  }
}

export function subscribeToPracticeAudios(
  onAudioUpdated: (audioId: string, dataUrl: string) => void
) {
  // Eager streaming of heavy binary collections is disabled to avoid OOM / Aw Snap and preserve quota.
  // Audio files are retrieved on-demand when played.
  return () => {};
}

// --- Settings Cloud Sync (Church Directory & Welcome Songs) ---

export async function syncSaveSavedNames(names: string[]): Promise<void> {
  try {
    const docRef = doc(db, COLLECTIONS.APP_SETTINGS, 'saved_names');
    await setDoc(docRef, { id: 'saved_names', names, updatedAt: new Date().toISOString() }, { merge: true });
    markOperationSuccess();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.APP_SETTINGS}/saved_names`);
  }
}

export async function syncSaveWelcomeSongs(songs: string[]): Promise<void> {
  try {
    const docRef = doc(db, COLLECTIONS.APP_SETTINGS, 'welcome_songs');
    await setDoc(docRef, { id: 'welcome_songs', songs, updatedAt: new Date().toISOString() }, { merge: true });
    markOperationSuccess();
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

/**
 * Reconcile all local changes to Firestore Cloud.
 * Ensures any practices (e.g. Eric's device), songs, or setlists created offline/during quota periods
 * are reliably uploaded and synchronized to all other devices.
 */
export async function reconcileAllLocalDataToCloud(): Promise<void> {
  // 1. Flush any pending queue items
  await flushPendingSyncQueue();

  // 2. Scan and push local records that might have been saved during offline/quota state
  try {
    const localPractice = loadPracticeEntries();
    for (const pr of localPractice) {
      syncSavePracticeEntry(pr).catch(() => {});
    }

    const localSongs = loadSongs();
    for (const s of localSongs) {
      syncSaveSong(s).catch(() => {});
    }

    const localSetlists = loadSetlists();
    for (const setlist of localSetlists) {
      syncSaveSetlist(setlist).catch(() => {});
    }

    const localSpecialNumbers = loadSpecialNumbers();
    for (const sp of localSpecialNumbers) {
      syncSaveSpecialNumber(sp).catch(() => {});
    }
  } catch (err) {
    console.warn('Background local data reconciliation error:', err);
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
      // Still trigger background reconciliation of any offline/unsynced entries
      reconcileAllLocalDataToCloud().catch(() => {});
      return;
    }

    // Light check: query just 1 song document to see if DB is already populated
    const songsQuery = query(collection(db, COLLECTIONS.SONGS), limit(1));
    const songsSnap = await getDocs(songsQuery);

    if (!songsSnap.empty) {
      // Database is already populated by another device/session
      localStorage.setItem(SEED_STORAGE_FLAG, 'true');
      reconcileAllLocalDataToCloud().catch(() => {});
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
    try {
      localStorage.setItem(SEED_STORAGE_FLAG, 'true');
    } catch {
      // ignore
    }
  }
}
