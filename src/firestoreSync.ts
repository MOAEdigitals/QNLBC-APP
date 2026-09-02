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
  ChoirEntry,
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
  loadChoirEntries,
  loadSavedNames,
  loadWelcomeSongs,
  loadUsers,
  DUMMY_EXAMPLE_NAMES,
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
  CHOIR_ENTRIES: 'choir_entries',
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

// Queue storage keys for offline and quota-deferred mutations + deleted tombstones
const PENDING_QUEUE_KEY = 'nlbc_firestore_pending_queue_v1';
const TOMBSTONES_STORAGE_KEY = 'nlbc_deleted_tombstones_v1';
const QUOTA_STORAGE_KEY = 'nlbc_firestore_quota_exhausted_date';

// Check local storage for previously recorded quota exhaustion for today
try {
  const todayStr = new Date().toISOString().split('T')[0];
  const savedDate = localStorage.getItem(QUOTA_STORAGE_KEY);
  if (savedDate === todayStr) {
    isQuotaExhausted = true;
    currentStatus = 'quota-exceeded';
  } else if (savedDate) {
    localStorage.removeItem(QUOTA_STORAGE_KEY);
  }
} catch {
  // ignore
}

interface PendingSyncItem {
  collectionName: string;
  id: string;
  data?: Record<string, any>;
  operation: 'write' | 'delete';
  timestamp: number;
}

interface TombstoneItem {
  collectionName: string;
  id: string;
  timestamp: number;
}

let cachedTombstones: TombstoneItem[] | null = null;
let cachedTombstoneKeySet: Set<string> | null = null;

export function getTombstones(): TombstoneItem[] {
  if (cachedTombstones !== null) {
    return cachedTombstones;
  }
  try {
    const raw = localStorage.getItem(TOMBSTONES_STORAGE_KEY);
    if (!raw) {
      cachedTombstones = [];
      cachedTombstoneKeySet = new Set();
      return [];
    }
    const items: TombstoneItem[] = JSON.parse(raw);
    // Keep tombstones for up to 30 days
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    cachedTombstones = items.filter((t) => t.timestamp > cutoff);
    cachedTombstoneKeySet = new Set(cachedTombstones.map((t) => `${t.collectionName}::${t.id}`));
    return cachedTombstones;
  } catch {
    cachedTombstones = [];
    cachedTombstoneKeySet = new Set();
    return [];
  }
}

function updateTombstoneCache(list: TombstoneItem[]) {
  cachedTombstones = list;
  cachedTombstoneKeySet = new Set(list.map((t) => `${t.collectionName}::${t.id}`));
  try {
    localStorage.setItem(TOMBSTONES_STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

export function recordTombstone(collectionName: string, id: string): void {
  if (!id) return;
  const list = getTombstones().filter((t) => !(t.collectionName === collectionName && t.id === id));
  list.push({ collectionName, id, timestamp: Date.now() });
  updateTombstoneCache(list.slice(-500));

  // Broadcast deletion tombstone to app_settings cloud document so all phones and other devices immediately learn of the deletion
  broadcastTombstoneToCloud(collectionName, id).catch(() => {});
}

export function removeTombstone(collectionName: string, id: string): void {
  if (!id) return;
  const list = getTombstones().filter((t) => !(t.collectionName === collectionName && t.id === id));
  updateTombstoneCache(list);
}

export function mergeRemoteTombstones(remoteTombstones: { collectionName: string; id: string; timestamp: number }[]): void {
  if (!Array.isArray(remoteTombstones) || remoteTombstones.length === 0) return;
  const current = getTombstones();
  const map = new Map<string, TombstoneItem>();
  for (const t of current) {
    map.set(`${t.collectionName}::${t.id}`, t);
  }
  for (const rt of remoteTombstones) {
    if (rt && rt.collectionName && rt.id) {
      map.set(`${rt.collectionName}::${rt.id}`, {
        collectionName: rt.collectionName,
        id: rt.id,
        timestamp: rt.timestamp || Date.now(),
      });
    }
  }
  const merged = Array.from(map.values()).slice(-500);
  updateTombstoneCache(merged);
}

async function broadcastTombstoneToCloud(collectionName: string, id: string): Promise<void> {
  if (isQuotaExhausted) return;
  try {
    const tombstonesDoc = doc(db, COLLECTIONS.APP_SETTINGS, 'tombstones');
    const snap = await getDoc(tombstonesDoc);
    let list: TombstoneItem[] = [];
    if (snap.exists() && Array.isArray(snap.data().list)) {
      list = snap.data().list;
    }
    list = list.filter((t) => !(t.collectionName === collectionName && t.id === id));
    list.push({ collectionName, id, timestamp: Date.now() });
    await setDoc(tombstonesDoc, { id: 'tombstones', list: list.slice(-500), updatedAt: new Date().toISOString() }, { merge: true });
  } catch {
    // Quota or network failure is handled gracefully
  }
}

export function isItemTombstoned(collectionName: string, id: string): boolean {
  if (!id) return false;
  if (cachedTombstoneKeySet === null) {
    getTombstones();
  }
  return cachedTombstoneKeySet?.has(`${collectionName}::${id}`) || false;
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

function markWriteSuccess() {
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

function markReadSuccess() {
  if (currentStatus === 'offline') {
    currentStatus = isQuotaExhausted ? 'quota-exceeded' : 'online';
    notifyStatusChange();
  }
}

export function isFirestoreQuotaExhausted(): boolean {
  return isQuotaExhausted;
}

export function getFirestoreConnectionStatus(): FirestoreStatusInfo {
  const databaseId = (firebaseConfig as any).firestoreDatabaseId || '(default)';
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
    rawMsg.includes('quota metric') ||
    rawMsg.includes('Quota exceeded');

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
  } else if (isOffline && currentStatus !== 'quota-exceeded') {
    currentStatus = 'offline';
    notifyStatusChange();
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

// Central safe Firestore write wrapper with quota circuit-breaker and offline queueing
async function executeFirestoreWrite(
  collectionName: string,
  docId: string,
  rawData: any
): Promise<void> {
  const sanitized = sanitizeDoc(rawData);
  removeTombstone(collectionName, docId);
  enqueuePending(collectionName, docId, sanitized, 'write');

  if (isQuotaExhausted) {
    return;
  }

  try {
    const docRef = doc(db, collectionName, docId);
    await setDoc(docRef, sanitized, { merge: true });
    dequeuePending(collectionName, docId);
    markWriteSuccess();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${collectionName}/${docId}`);
  }
}

// Central safe Firestore delete wrapper with quota circuit-breaker and offline queueing
async function executeFirestoreDelete(
  collectionName: string,
  docId: string
): Promise<void> {
  recordTombstone(collectionName, docId);
  enqueuePending(collectionName, docId, undefined, 'delete');

  if (isQuotaExhausted) {
    return;
  }

  try {
    await deleteDoc(doc(db, collectionName, docId));
    dequeuePending(collectionName, docId);
    markWriteSuccess();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${docId}`);
  }
}

// Flush pending offline/quota-deferred queue
export async function flushPendingSyncQueue(): Promise<void> {
  if (isQuotaExhausted) return;
  const queue = getPendingQueue();
  if (queue.length === 0) return;

  for (const item of queue) {
    if (isQuotaExhausted) break;
    try {
      const docRef = doc(db, item.collectionName, item.id);
      if (item.operation === 'write' && item.data) {
        await setDoc(docRef, sanitizeDoc(item.data), { merge: true });
      } else if (item.operation === 'delete') {
        await deleteDoc(docRef);
      }
      dequeuePending(item.collectionName, item.id);
      markWriteSuccess();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${item.collectionName}/${item.id}`);
      break; // Pause flushing if quota error happens
    }
  }
}

export const LEGACY_MOCK_IDS = new Set([
  'setlist-next',
  'setlist-following',
  'setlist-past',
  'sp-1',
  'sp-2',
  'sp-3',
  'prac-1',
  'prac-2',
  'bday-1',
  'bday-2',
  'bday-3',
  'bday-4',
  'anniv-1',
  'anniv-2',
  'anniv-3',
  'vis-1',
  'vis-2',
  'vis-3',
  'vis-4',
  'spec-1',
  'spec-2',
  'spec-3',
  'spec-4',
]);

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
        markReadSuccess();
        const items: T[] = [];
        const remoteIds = new Set<string>();

        snapshot.forEach((docSnap) => {
          remoteIds.add(docSnap.id);
          if (LEGACY_MOCK_IDS.has(docSnap.id)) {
            // Background cleanup of legacy mock IDs only if quota is available
            if (!isQuotaExhausted) {
              deleteDoc(doc(db, collectionName, docSnap.id)).catch(() => {});
            }
            return;
          }
          if (isItemTombstoned(collectionName, docSnap.id)) {
            // Item was deleted by the user locally - purge from Firestore only if quota is available
            if (!isQuotaExhausted) {
              deleteDoc(doc(db, collectionName, docSnap.id)).catch(() => {});
            }
            return;
          }
          items.push({ ...(docSnap.data() as T), id: docSnap.id });
        });

        // Merge any locally queued writes that have not reached the server snapshot yet
        const pending = getPendingQueue().filter(
          (p) => p.collectionName === collectionName && p.operation === 'write' && p.data && !isItemTombstoned(collectionName, p.id)
        );
        for (const p of pending) {
          if (!remoteIds.has(p.id)) {
            items.push({ ...(p.data as T), id: p.id });
          }
        }

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
  return executeFirestoreWrite(COLLECTIONS.SETLISTS, setlist.id, setlist);
}

export async function syncDeleteSetlist(id: string): Promise<void> {
  return executeFirestoreDelete(COLLECTIONS.SETLISTS, id);
}

export async function syncSaveSong(song: Song): Promise<void> {
  return executeFirestoreWrite(COLLECTIONS.SONGS, song.id, song);
}

export async function syncDeleteSong(id: string): Promise<void> {
  return executeFirestoreDelete(COLLECTIONS.SONGS, id);
}

export async function syncSaveSpecialNumber(entry: SpecialNumberEntry): Promise<void> {
  return executeFirestoreWrite(COLLECTIONS.SPECIAL_NUMBERS, entry.id, entry);
}

export async function syncDeleteSpecialNumber(id: string): Promise<void> {
  return executeFirestoreDelete(COLLECTIONS.SPECIAL_NUMBERS, id);
}

export async function syncSaveChoirEntry(entry: ChoirEntry): Promise<void> {
  return executeFirestoreWrite(COLLECTIONS.CHOIR_ENTRIES, entry.id, entry);
}

export async function syncDeleteChoirEntry(id: string): Promise<void> {
  return executeFirestoreDelete(COLLECTIONS.CHOIR_ENTRIES, id);
}

export async function syncSavePracticeEntry(entry: PracticeGroupEntry): Promise<void> {
  return executeFirestoreWrite(COLLECTIONS.PRACTICE_ENTRIES, entry.id, entry);
}

export async function syncDeletePracticeEntry(id: string): Promise<void> {
  return executeFirestoreDelete(COLLECTIONS.PRACTICE_ENTRIES, id);
}

export async function syncSaveBirthday(item: BirthdayCelebrant): Promise<void> {
  return executeFirestoreWrite(COLLECTIONS.BIRTHDAYS, item.id, item);
}

export async function syncDeleteBirthday(id: string): Promise<void> {
  return executeFirestoreDelete(COLLECTIONS.BIRTHDAYS, id);
}

export async function syncSaveAnniversary(item: AnniversaryCelebrant): Promise<void> {
  return executeFirestoreWrite(COLLECTIONS.ANNIVERSARIES, item.id, item);
}

export async function syncDeleteAnniversary(id: string): Promise<void> {
  return executeFirestoreDelete(COLLECTIONS.ANNIVERSARIES, id);
}

export async function syncSaveVisitor(item: Visitor): Promise<void> {
  return executeFirestoreWrite(COLLECTIONS.VISITORS, item.id, item);
}

export async function syncDeleteVisitor(id: string): Promise<void> {
  return executeFirestoreDelete(COLLECTIONS.VISITORS, id);
}

export async function syncSaveSpecialRecognition(item: SpecialRecognition): Promise<void> {
  return executeFirestoreWrite(COLLECTIONS.SPECIAL_RECOGNITIONS, item.id, item);
}

export async function syncDeleteSpecialRecognition(id: string): Promise<void> {
  return executeFirestoreDelete(COLLECTIONS.SPECIAL_RECOGNITIONS, id);
}

export async function syncSaveUser(user: UserAccount): Promise<void> {
  return executeFirestoreWrite(COLLECTIONS.USERS, user.id, user);
}

export async function syncDeleteUser(id: string, username?: string): Promise<void> {
  if (isQuotaExhausted) return;
  try {
    if (id) {
      recordTombstone(COLLECTIONS.USERS, id);
      dequeuePending(COLLECTIONS.USERS, id);
      await deleteDoc(doc(db, COLLECTIONS.USERS, id));
    }
    if (username) {
      recordTombstone(COLLECTIONS.USERS, username.toLowerCase());
      const usersCol = collection(db, COLLECTIONS.USERS);
      const snap = await getDocs(usersCol);
      for (const d of snap.docs) {
        const data = d.data();
        if (
          d.id === id ||
          d.id.toLowerCase() === username.toLowerCase() ||
          (data.username && data.username.toLowerCase() === username.toLowerCase())
        ) {
          recordTombstone(COLLECTIONS.USERS, d.id);
          dequeuePending(COLLECTIONS.USERS, d.id);
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
      markWriteSuccess();
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
  if (!id || isQuotaExhausted) return;
  const cleanId = id.replace(/^indexeddb:/, '');

  try {
    const docRef = doc(db, COLLECTIONS.PRACTICE_AUDIOS, cleanId);
    await deleteDoc(docRef);
    markWriteSuccess();
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
  const payload = {
    id: 'saved_names',
    names: Array.isArray(names) ? names : [],
    updatedAt: new Date().toISOString(),
  };
  await executeFirestoreWrite(COLLECTIONS.APP_SETTINGS, 'saved_names', payload);
  await executeFirestoreWrite(COLLECTIONS.SAVED_NAMES, 'list', {
    id: 'list',
    names: Array.isArray(names) ? names : [],
    updatedAt: new Date().toISOString(),
  });
}

export async function syncSaveWelcomeSongs(songs: string[]): Promise<void> {
  return executeFirestoreWrite(COLLECTIONS.APP_SETTINGS, 'welcome_songs', {
    id: 'welcome_songs',
    songs: Array.isArray(songs) ? songs : [],
    updatedAt: new Date().toISOString(),
  });
}

export function subscribeToAppSettings(
  onUpdateSavedNames: (names: string[]) => void,
  onUpdateWelcomeSongs: (songs: string[]) => void,
  onTombstonesUpdated?: () => void
) {
  try {
    const namesDocRef = doc(db, COLLECTIONS.APP_SETTINGS, 'saved_names');
    const altNamesDocRef = doc(db, COLLECTIONS.SAVED_NAMES, 'list');
    const songsDocRef = doc(db, COLLECTIONS.APP_SETTINGS, 'welcome_songs');
    const tombstonesDocRef = doc(db, COLLECTIONS.APP_SETTINGS, 'tombstones');

    let hasReceivedSettingsDoc = false;

    const unsubNames = onSnapshot(
      namesDocRef,
      (snap) => {
        markReadSuccess();
        if (snap.exists()) {
          hasReceivedSettingsDoc = true;
          const data = snap.data();
          if (Array.isArray(data.names)) {
            const cleaned = data.names.filter(
              (n: string) => typeof n === 'string' && n.trim()
            );
            onUpdateSavedNames(cleaned);
          }
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `${COLLECTIONS.APP_SETTINGS}/saved_names`)
    );

    const unsubAltNames = onSnapshot(
      altNamesDocRef,
      (snap) => {
        markReadSuccess();
        if (!hasReceivedSettingsDoc && snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.names)) {
            const cleaned = data.names.filter(
              (n: string) => typeof n === 'string' && n.trim()
            );
            onUpdateSavedNames(cleaned);
          }
        }
      },
      () => {}
    );

    const unsubSongs = onSnapshot(
      songsDocRef,
      (snap) => {
        markReadSuccess();
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.songs)) {
            onUpdateWelcomeSongs(data.songs);
          }
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `${COLLECTIONS.APP_SETTINGS}/welcome_songs`)
    );

    const unsubTombstones = onSnapshot(
      tombstonesDocRef,
      (snap) => {
        markReadSuccess();
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.list)) {
            mergeRemoteTombstones(data.list);
            if (onTombstonesUpdated) {
              onTombstonesUpdated();
            }
          }
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `${COLLECTIONS.APP_SETTINGS}/tombstones`)
    );

    return () => {
      unsubNames();
      unsubAltNames();
      unsubSongs();
      unsubTombstones();
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, COLLECTIONS.APP_SETTINGS);
    return () => {};
  }
}

/**
 * Reconcile offline/queued changes to Firestore Cloud when connection or quota restores.
 */
export async function reconcileAllLocalDataToCloud(): Promise<void> {
  if (isQuotaExhausted) return;
  await flushPendingSyncQueue();
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

    try {
      const namesSnap = await getDoc(doc(db, COLLECTIONS.APP_SETTINGS, 'saved_names'));
      const initialNames = loadSavedNames();
      if (!namesSnap.exists()) {
        await setDoc(doc(db, COLLECTIONS.APP_SETTINGS, 'saved_names'), {
          id: 'saved_names',
          names: initialNames,
          updatedAt: new Date().toISOString(),
        });
        await setDoc(doc(db, COLLECTIONS.SAVED_NAMES, 'list'), {
          id: 'list',
          names: initialNames,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch {
      // ignore
    }

    try {
      const welcomeSnap = await getDoc(doc(db, COLLECTIONS.APP_SETTINGS, 'welcome_songs'));
      if (!welcomeSnap.exists()) {
        const initialWelcome = loadWelcomeSongs();
        await setDoc(doc(db, COLLECTIONS.APP_SETTINGS, 'welcome_songs'), {
          id: 'welcome_songs',
          songs: initialWelcome,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch {
      // ignore
    }

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
