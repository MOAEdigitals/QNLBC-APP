// Universal Cloud Media Storage Service (Cloudflare R2 & Server Storage)
// Allows all church members to upload audio/media (>1MB, MP3s, WAV, voice recordings)
// and have them instantly streamable and synced across all devices without personal Google logins.

import { saveAudioToStorage, getAudioFromStorage } from '../utils/audioStorage';

export interface MediaUploadResult {
  url: string;
  fileName: string;
  size: number;
  isCloudUrl: boolean;
  provider?: string;
  error?: string;
}

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const UPLOAD_ENDPOINT = `${API_BASE}/api/upload-media`;

/**
 * Convert dataUrl to Blob safely using browser native fetch or fallback
 */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  try {
    const res = await fetch(dataUrl);
    return await res.blob();
  } catch {
    try {
      const arr = dataUrl.split(',');
      const mime = arr[0]?.match(/:(.*?);/)?.[1] || 'audio/mpeg';
      const cleanBase64 = (arr[1] || '').replace(/\s+/g, '');
      const bstr = atob(cleanBase64);
      const u8arr = new Uint8Array(bstr.length);
      for (let i = 0; i < bstr.length; i++) {
        u8arr[i] = bstr.charCodeAt(i);
      }
      return new Blob([u8arr], { type: mime });
    } catch (e) {
      console.warn('Fallback Blob creation failed:', e);
      return new Blob([], { type: 'audio/mpeg' });
    }
  }
}

/**
 * Upload an Audio File or Voice Recording to Universal Cloud Media Storage (Cloudflare R2)
 * Supports full MP3 minus-ones, vocal stems, and choir practice tracks (>1MB, up to 50MB).
 * Automatically caches to IndexedDB for local zero-latency offline playback.
 */
export async function uploadMediaToCloudStorage(
  fileOrData: File | Blob | string,
  fileId: string,
  originalFileName?: string,
  onProgress?: (percent: number) => void
): Promise<MediaUploadResult> {
  const cleanId = fileId.replace(/^indexeddb:/, '');
  let fileName = originalFileName || `track_${cleanId}.mp3`;

  // If already an external cloud URL (e.g. YouTube, external MP3 link, or existing R2 link)
  if (typeof fileOrData === 'string' && (fileOrData.startsWith('http://') || fileOrData.startsWith('https://'))) {
    return {
      url: fileOrData,
      fileName,
      size: 0,
      isCloudUrl: true,
    };
  }

  // 1. Immediately cache to local IndexedDB for zero-latency playback on the current device
  if (typeof fileOrData === 'string' && fileOrData.startsWith('data:')) {
    saveAudioToStorage(cleanId, fileOrData, fileName).catch((err) => {
      console.warn('Local audio cache error:', err);
    });
  } else if (typeof fileOrData !== 'string') {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        saveAudioToStorage(cleanId, reader.result, fileName).catch(() => {});
      }
    };
    reader.readAsDataURL(fileOrData);
  }

  // 2. Direct JSON upload for dataUrls (highly reliable on mobile browsers, bypasses FormData bugs)
  if (typeof fileOrData === 'string' && fileOrData.startsWith('data:')) {
    try {
      if (onProgress) onProgress(15);
      const jsonRes = await fetch(UPLOAD_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataUrl: fileOrData,
          fileId: cleanId,
          fileName,
        }),
      });

      if (jsonRes.ok) {
        const json = await jsonRes.json();
        if (json.success && json.url) {
          if (onProgress) onProgress(100);
          console.log(`[Cloud Media Storage] JSON upload success: ${fileName} -> ${json.url}`);
          return {
            url: json.url,
            fileName: json.fileName || fileName,
            size: json.size || 0,
            isCloudUrl: Boolean(json.isCloudUrl),
            provider: json.provider,
          };
        }
      }
    } catch (jsonErr) {
      console.warn('[Cloud Media Storage] JSON direct upload failed, attempting multipart fallback...', jsonErr);
    }
  }

  // 3. Multipart FormData upload
  let blob: Blob;
  if (typeof fileOrData === 'string') {
    if (fileOrData.startsWith('data:')) {
      blob = await dataUrlToBlob(fileOrData);
      const mime = blob.type || 'audio/mpeg';
      if (!originalFileName) {
        fileName = `recording_${cleanId}.${mime.includes('webm') ? 'webm' : 'mp3'}`;
      }
    } else {
      blob = new Blob([], { type: 'audio/mpeg' });
    }
  } else {
    blob = fileOrData;
    if ((fileOrData as File).name) {
      fileName = (fileOrData as File).name;
    }
  }

  // Helper for single upload attempt with timeout
  const performUpload = (currentBlob: Blob, curFileName: string, curId: string): Promise<MediaUploadResult> => {
    return new Promise<MediaUploadResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', UPLOAD_ENDPOINT, true);
      // Allow 3 minutes for slow mobile cellular connections
      xhr.timeout = 180000;

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && event.total > 0) {
            const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const json = JSON.parse(xhr.responseText);
            if (json.success && json.url) {
              if (onProgress) onProgress(100);
              resolve({
                url: json.url,
                fileName: json.fileName || curFileName,
                size: json.size || currentBlob.size,
                isCloudUrl: Boolean(json.isCloudUrl),
                provider: json.provider,
              });
            } else {
              reject(new Error(json.error || json.details || 'Upload failed'));
            }
          } catch (err) {
            reject(new Error(`Failed to parse upload server response: ${String(err)}`));
          }
        } else {
          try {
            const errJson = JSON.parse(xhr.responseText);
            reject(new Error(errJson.error || errJson.details || `Upload failed with HTTP ${xhr.status}`));
          } catch {
            reject(new Error(`Server upload returned status ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error connecting to upload endpoint'));
      };

      xhr.ontimeout = () => {
        reject(new Error('Upload timed out after 3 minutes. Please check your internet connection.'));
      };

      const formData = new FormData();
      formData.append('file', currentBlob, curFileName);
      formData.append('fileId', curId);
      formData.append('fileName', curFileName);

      xhr.send(formData);
    });
  };

  // Upload to Cloud Media Storage via UPLOAD_ENDPOINT with retries
  try {
    return await performUpload(blob, fileName, cleanId);
  } catch (firstErr) {
    console.warn('[Cloud Upload] Endpoint attempt failed, checking backend availability...', firstErr);
    try {
      return await performUpload(blob, fileName, cleanId);
    } catch (retryErr: any) {
      console.warn('[Cloud Upload] Backend upload endpoint unavailable (e.g. static GitHub Pages). Uploading to Universal Firestore Cloud Media Storage...', retryErr);
      
      // Fallback: Direct Firestore Cloud Media Storage (guarantees cross-device playability without a backend server)
      try {
        const firestoreResult = await uploadToFirestoreCloudMedia(fileOrData, cleanId, fileName, onProgress);
        return firestoreResult;
      } catch (firestoreErr: any) {
        console.error('[Cloud Upload] Universal Firestore Cloud Storage error:', firestoreErr);
        return {
          url: `indexeddb:${cleanId}`,
          fileName,
          size: blob.size,
          isCloudUrl: false,
          error: firestoreErr?.message || String(firestoreErr),
        };
      }
    }
  }
}

/**
 * Upload audio directly to Firestore Cloud Media Storage in ~400KB chunks
 * Guarantees cross-device & cross-browser playback even on static hosting like GitHub Pages!
 * Verifies the stored object and shared reference before returning cloud-ready.
 */
export async function uploadToFirestoreCloudMedia(
  fileOrData: File | Blob | string,
  fileId: string,
  originalFileName: string,
  onProgress?: (percent: number) => void
): Promise<MediaUploadResult> {
  const cleanId = fileId.replace(/^indexeddb:/, '').replace(/^firestore:media:/, '');
  const fileName = originalFileName || `audio_${cleanId}.mp3`;

  // 1. Convert to base64
  let base64 = '';
  let mimeType = 'audio/mpeg';

  if (typeof fileOrData === 'string' && fileOrData.startsWith('data:')) {
    const parts = fileOrData.split(',');
    mimeType = parts[0]?.match(/:(.*?);/)?.[1] || 'audio/mpeg';
    base64 = (parts[1] || '').replace(/\s+/g, '');
  } else {
    let blob: Blob;
    if (typeof fileOrData === 'string') {
      blob = await dataUrlToBlob(fileOrData);
    } else {
      blob = fileOrData;
    }
    mimeType = blob.type || 'audio/mpeg';
    base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result as string;
        const b64 = res ? (res.split(',')[1] || '').replace(/\s+/g, '') : '';
        resolve(b64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  if (!base64) {
    throw new Error('No audio data available for cloud storage');
  }

  // Preserve in local IndexedDB for the uploading device
  const fullDataUrl = `data:${mimeType};base64,${base64}`;
  saveAudioToStorage(cleanId, fullDataUrl, fileName).catch((err) => {
    console.warn('Preserving local recording in IndexedDB:', err);
  });

  const fileSize = Math.round((base64.length * 3) / 4);

  // Safe chunk size for Firestore document limit (< 1MB)
  // 400KB base64 chunk (~300KB raw audio)
  const CHUNK_SIZE = 400000;
  const chunkCount = Math.ceil(base64.length / CHUNK_SIZE);

  if (onProgress) onProgress(15);

  const { db } = await import('../firebase');
  const { doc, setDoc, getDoc } = await import('firebase/firestore');

  // Write all chunk documents
  for (let i = 0; i < chunkCount; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, base64.length);
    const chunkData = base64.slice(start, end);

    const chunkRef = doc(db, 'practice_audio_chunks', `${cleanId}_chunk_${i}`);
    await setDoc(chunkRef, {
      trackId: cleanId,
      index: i,
      data: chunkData,
      updatedAt: new Date().toISOString(),
    });

    if (onProgress) {
      const pct = Math.min(90, Math.round(15 + ((i + 1) / chunkCount) * 75));
      onProgress(pct);
    }
  }

  // Write top-level metadata document
  const metaRef = doc(db, 'practice_audios', cleanId);
  await setDoc(metaRef, {
    id: cleanId,
    fileName,
    mimeType,
    size: fileSize,
    chunkCount,
    isCloudReady: true,
    provider: 'firestore-cloud-storage',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Verify the stored object and shared reference before marking cloud-ready
  const verifySnap = await getDoc(metaRef);
  if (!verifySnap.exists() || !verifySnap.data()?.isCloudReady) {
    throw new Error('Cloud verification failed: Stored media document could not be verified in Firestore');
  }

  // Verify the first chunk can be retrieved
  const verifyChunk = await getDoc(doc(db, 'practice_audio_chunks', `${cleanId}_chunk_0`));
  if (!verifyChunk.exists()) {
    throw new Error('Cloud verification failed: First chunk could not be read back from Firestore');
  }

  if (onProgress) onProgress(100);

  const cloudUrl = `firestore:media:${cleanId}`;
  console.log(`[Universal Cloud Storage] Verified stored object and shared reference: ${fileName} (${fileSize} bytes) -> ${cloudUrl}`);

  return {
    url: cloudUrl,
    fileName,
    size: fileSize,
    isCloudUrl: true,
    provider: 'firestore-cloud-storage',
  };
}

/**
 * Upload an existing IndexedDB audio recording directly to Cloudflare R2
 * Returns the permanent public Cloud URL if successful, or null if audio not found / failed.
 */
export async function syncLocalAudioToCloud(
  audioId: string,
  customTitle?: string,
  fallbackId?: string,
  onProgress?: (percent: number) => void
): Promise<string | null> {
  const cleanId = audioId.replace(/^indexeddb:/, '');
  const localData = await getAudioFromStorage(cleanId, fallbackId);
  if (!localData) {
    return null;
  }

  // If already a cloud URL
  if (localData.startsWith('http://') || localData.startsWith('https://')) {
    return localData;
  }

  if (!localData.startsWith('data:')) {
    return null;
  }

  const fileName = `${customTitle ? customTitle.replace(/[^a-zA-Z0-9_-]/g, '_') : 'track'}_${cleanId}.mp3`;
  const result = await uploadMediaToCloudStorage(localData, cleanId, fileName, onProgress);
  if (result.isCloudUrl && result.url && !result.url.startsWith('indexeddb:')) {
    return result.url;
  }
  return null;
}

/**
 * Delete a media file from Cloud Media Storage with verified HTTP response check
 */
export async function deleteMediaFromCloudStorage(urlOrPath: string): Promise<boolean> {
  if (!urlOrPath) return false;
  try {
    const res = await fetch(`${UPLOAD_ENDPOINT}?url=${encodeURIComponent(urlOrPath)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (err) {
    console.warn('Could not delete media file from storage:', err);
    return false;
  }
}
