// IndexedDB Audio & Media Blob Store for offline vocal stem recordings and audio attachments with Cloud Sync
import {
  syncSavePracticeAudio,
  fetchPracticeAudioFromCloud,
  syncDeletePracticeAudio,
} from '../firestoreSync';

const DB_NAME = 'nlbc_media_db_v1';
const STORE_NAME = 'audio_blobs';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;
const audioMemCache = new Map<string, string>();

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });

  return dbPromise;
}

export interface StoredAudioItem {
  id: string;
  dataUrl: string;
  fileName?: string;
  mimeType?: string;
  updatedAt: string;
}

/**
 * Save audio dataUrl (or recording) in IndexedDB, in-memory cache, and sync to Firestore Cloud
 */
export async function saveAudioToStorage(id: string, dataUrl: string, fileName?: string): Promise<void> {
  if (!id || !dataUrl) return;
  const cleanId = id.replace(/^indexeddb:/, '');
  audioMemCache.set(cleanId, dataUrl);

  // 1. Save to local IndexedDB for fast offline retrieval
  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const item: StoredAudioItem = {
        id: cleanId,
        dataUrl,
        fileName,
        mimeType: dataUrl.split(';')[0]?.replace('data:', '') || 'audio/webm',
        updatedAt: new Date().toISOString(),
      };
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to save audio to IndexedDB:', err);
  }

  // Notify active components in the current window
  notifyAudioStored(cleanId, dataUrl);

  // 2. Asynchronously sync to Firestore so all other devices (Desktop, Mobile, Tablet) get it
  try {
    syncSavePracticeAudio(cleanId, dataUrl, fileName).catch((err) => {
      console.warn('Background audio sync error:', err);
    });
  } catch (err) {
    console.warn('Failed to dispatch cloud audio sync:', err);
  }
}

/**
 * Listen to audio storage updates across components in the same tab / browser window
 */
export const subscribeToAudioUpdates = (callback: (audioId: string, base64Data: string) => void) => {
  const handler = (e: Event) => {
    const customEvent = e as CustomEvent<{ id: string; data: string }>;
    if (customEvent.detail) {
      callback(customEvent.detail.id, customEvent.detail.data);
    }
  };
  window.addEventListener('qnlbc_audio_stored', handler);
  return () => window.removeEventListener('qnlbc_audio_stored', handler);
};

/**
 * Notify other components that audio data has been saved or updated
 */
export const notifyAudioStored = (audioId: string, base64Data: string) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('qnlbc_audio_stored', { detail: { id: audioId, data: base64Data } })
    );
  }
};

/**
 * Get audio dataUrl by track/part ID:
 * 1. Checks memory cache
 * 2. Checks local IndexedDB for exact ID match
 * 3. Scans IndexedDB records in case ID differed between attachment and storage key
 * 4. If not found locally, fetches from Firestore Cloud and caches locally for future instant playback!
 */
export async function getAudioFromStorage(
  id: string,
  ...fallbackIds: (string | undefined | null)[]
): Promise<string | null> {
  const allIds = [id, ...fallbackIds]
    .filter((x): x is string => Boolean(x && typeof x === 'string'))
    .map((x) => x.trim().replace(/^indexeddb:/, ''))
    .filter(Boolean);

  if (allIds.length === 0) return null;

  // 1. Check memory cache for any matching ID
  for (const testId of allIds) {
    if (audioMemCache.has(testId)) {
      const cached = audioMemCache.get(testId);
      if (cached) return cached;
    }
  }

  // 2. Check local IndexedDB
  try {
    const db = await getDB();
    for (const testId of allIds) {
      const localAudio = await new Promise<string | null>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(testId);
        req.onsuccess = () => {
          if (req.result && req.result.dataUrl) {
            resolve(req.result.dataUrl);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });

      if (localAudio) {
        audioMemCache.set(testId, localAudio);
        return localAudio;
      }
    }
  } catch {
    // Continue to scan / cloud fallback
  }

  // 3. Fallback scan: in case timestamp or attachment ID differed slightly
  try {
    const db = await getDB();
    const allRecords = await new Promise<StoredAudioItem[]>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    for (const record of allRecords) {
      for (const testId of allIds) {
        if (
          record.id === testId ||
          record.id.includes(testId) ||
          testId.includes(record.id)
        ) {
          if (record.dataUrl) {
            audioMemCache.set(testId, record.dataUrl);
            return record.dataUrl;
          }
        }
      }
    }
  } catch {
    // Continue to cloud fallback
  }

  // 4. If not found locally on this device, fetch from Firestore Cloud!
  for (const testId of allIds) {
    try {
      const cloudAudio = await fetchPracticeAudioFromCloud(testId);
      if (cloudAudio) {
        audioMemCache.set(testId, cloudAudio);
        // Cache into local IndexedDB for future plays
        try {
          const db = await getDB();
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.put({
            id: testId,
            dataUrl: cloudAudio,
            mimeType: cloudAudio.split(';')[0]?.replace('data:', '') || 'audio/webm',
            updatedAt: new Date().toISOString(),
          });
        } catch {
          // Cache failure is non-fatal
        }
        return cloudAudio;
      }
    } catch (err) {
      console.warn(`Failed to fetch audio ${testId} from cloud:`, err);
    }
  }

  return null;
}

/**
 * Delete audio data by ID (both locally and from Firestore Cloud)
 */
export async function deleteAudioFromStorage(id: string): Promise<void> {
  if (!id) return;
  const cleanId = id.replace(/^indexeddb:/, '');
  audioMemCache.delete(cleanId);

  // 1. Delete from IndexedDB
  try {
    const db = await getDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(cleanId);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // ignore
  }

  // 2. Delete from Firestore Cloud
  try {
    await syncDeletePracticeAudio(cleanId);
  } catch (err) {
    console.warn(`Failed to delete audio ${cleanId} from cloud:`, err);
  }
}

