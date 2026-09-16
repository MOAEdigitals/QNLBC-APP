// IndexedDB Audio & Media Blob Store for offline vocal stem recordings and audio attachments
// Audio files are hosted on Cloudflare R2 and cached locally in IndexedDB (zero Firestore reads/writes)

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
  // Check if any of the passed arguments are already direct web / Firebase Cloud Storage URLs
  for (const raw of [id, ...fallbackIds]) {
    if (raw && typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('blob:')) {
        return trimmed;
      }
    }
  }

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

  // 4. Cross-browser cloud retrieval: If not found locally in IndexedDB, fetch from Firestore Cloud Media!
  for (const testId of allIds) {
    try {
      const cloudAudio = await fetchAudioFromFirestoreCloud(testId);
      if (cloudAudio) {
        audioMemCache.set(testId, cloudAudio);
        return cloudAudio;
      }
    } catch (err) {
      console.warn(`[Audio Storage] Firestore cloud retrieval error for ${testId}:`, err);
    }
  }

  return null;
}

/**
 * Fetch audio from Firestore Cloud Media (enables instant playback on Ecosia/secondary devices)
 * Caches retrieved audio locally into IndexedDB for zero-latency future playback.
 */
export async function fetchAudioFromFirestoreCloud(trackId: string): Promise<string | null> {
  if (!trackId) return null;
  const cleanId = trackId
    .trim()
    .replace(/^indexeddb:/, '')
    .replace(/^firestore:media:/, '');

  try {
    const { db } = await import('../firebase');
    const { doc, getDoc } = await import('firebase/firestore');

    const metaRef = doc(db, 'practice_audios', cleanId);
    const metaSnap = await getDoc(metaRef);
    if (!metaSnap.exists()) {
      return null;
    }

    const meta = metaSnap.data();
    const chunkCount = meta?.chunkCount || 0;
    const mimeType = meta?.mimeType || 'audio/mpeg';

    if (chunkCount <= 0) {
      return null;
    }

    const chunks: string[] = [];
    for (let i = 0; i < chunkCount; i++) {
      const chunkRef = doc(db, 'practice_audio_chunks', `${cleanId}_chunk_${i}`);
      const chunkSnap = await getDoc(chunkRef);
      if (!chunkSnap.exists() || !chunkSnap.data()?.data) {
        console.warn(`[Firestore Cloud Media] Missing chunk ${i} of ${chunkCount} for track ${cleanId}`);
        return null;
      }
      chunks.push(chunkSnap.data()!.data);
    }

    const fullBase64 = chunks.join('');
    const dataUrl = `data:${mimeType};base64,${fullBase64}`;

    // Cache locally into IndexedDB on this device so next time it loads instantly offline
    saveAudioToStorage(cleanId, dataUrl, meta?.fileName).catch((err) => {
      console.warn('Failed to cache retrieved cloud audio into IndexedDB:', err);
    });

    console.log(`[Firestore Cloud Media] Successfully loaded & cached track ${cleanId} (${chunks.length} chunks)`);
    return dataUrl;
  } catch (err) {
    console.warn(`[Firestore Cloud Media] Error fetching cloud audio for ${cleanId}:`, err);
    return null;
  }
}

/**
 * Verify whether a media track exists in Cloud Storage (Firestore or R2)
 */
export async function isCloudMediaReady(mediaUrlOrId: string): Promise<boolean> {
  if (!mediaUrlOrId) return false;
  const trimmed = mediaUrlOrId.trim();

  // If Cloudflare R2 or direct HTTP(S) URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const res = await fetch(trimmed, { method: 'HEAD' });
      return res.ok;
    } catch {
      // If HEAD fails due to CORS, check if it's an R2 domain
      return trimmed.includes('r2.dev') || trimmed.includes('cloudfront.net');
    }
  }

  // If Firestore Cloud Media reference
  const cleanId = trimmed.replace(/^indexeddb:/, '').replace(/^firestore:media:/, '');
  try {
    const { db } = await import('../firebase');
    const { doc, getDoc } = await import('firebase/firestore');
    const metaSnap = await getDoc(doc(db, 'practice_audios', cleanId));
    return metaSnap.exists() && Boolean(metaSnap.data()?.isCloudReady);
  } catch {
    return false;
  }
}

/**
 * Delete audio data by ID from local IndexedDB & memory cache
 */
export async function deleteAudioFromStorage(id: string): Promise<void> {
  if (!id) return;
  const cleanId = id.replace(/^indexeddb:/, '').replace(/^firestore:media:/, '');
  audioMemCache.delete(cleanId);

  // Delete from IndexedDB
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

  // Also clean up from Firestore cloud if exists
  try {
    const { db } = await import('../firebase');
    const { doc, deleteDoc, getDoc } = await import('firebase/firestore');
    const metaRef = doc(db, 'practice_audios', cleanId);
    const metaSnap = await getDoc(metaRef);
    if (metaSnap.exists()) {
      const count = metaSnap.data()?.chunkCount || 0;
      for (let i = 0; i < count; i++) {
        deleteDoc(doc(db, 'practice_audio_chunks', `${cleanId}_chunk_${i}`)).catch(() => {});
      }
      await deleteDoc(metaRef);
    }
  } catch {
    // ignore cloud deletion errors
  }
}

