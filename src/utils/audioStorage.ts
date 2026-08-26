// IndexedDB Audio & Media Blob Store for offline vocal stem recordings and audio attachments
const DB_NAME = 'nlbc_media_db_v1';
const STORE_NAME = 'audio_blobs';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

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
 * Save audio dataUrl (or recording) in IndexedDB
 */
export async function saveAudioToStorage(id: string, dataUrl: string, fileName?: string): Promise<void> {
  if (!id || !dataUrl) return;
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const item: StoredAudioItem = {
        id,
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
}

/**
 * Get audio dataUrl by track/part ID
 */
export async function getAudioFromStorage(id: string): Promise<string | null> {
  if (!id) return null;
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result && req.result.dataUrl) {
          resolve(req.result.dataUrl);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Delete audio data by ID
 */
export async function deleteAudioFromStorage(id: string): Promise<void> {
  if (!id) return;
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}
