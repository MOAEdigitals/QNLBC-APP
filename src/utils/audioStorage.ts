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
 * Get audio dataUrl by track/part ID:
 * 1. Checks memory cache
 * 2. Checks local IndexedDB
 * 3. If not found locally, fetches from Firestore Cloud and caches locally for future instant playback!
 */
export async function getAudioFromStorage(id: string): Promise<string | null> {
  if (!id) return null;
  const cleanId = id.replace(/^indexeddb:/, '');

  if (audioMemCache.has(cleanId)) {
    return audioMemCache.get(cleanId) || null;
  }

  // 1. Check local IndexedDB
  try {
    const db = await getDB();
    const localAudio = await new Promise<string | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(cleanId);
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
      audioMemCache.set(cleanId, localAudio);
      return localAudio;
    }
  } catch {
    // Continue to cloud fallback
  }

  // 2. If not found locally on this device, fetch from Firestore Cloud!
  try {
    const cloudAudio = await fetchPracticeAudioFromCloud(cleanId);
    if (cloudAudio) {
      audioMemCache.set(cleanId, cloudAudio);
      // Cache into local IndexedDB for future plays
      try {
        const db = await getDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({
          id: cleanId,
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
    console.warn(`Failed to fetch audio ${cleanId} from cloud:`, err);
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

