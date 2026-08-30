// Universal Cloud Media Storage Service (Firebase Storage)
// Allows all church members to upload audio/media (>1MB, MP3s, WAV, voice recordings)
// and have them instantly streamable and synced across all devices without personal Google logins.

import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  UploadTaskSnapshot,
} from 'firebase/storage';
import { storage } from '../firebase';
import { saveAudioToStorage } from '../utils/audioStorage';

export interface MediaUploadResult {
  url: string;
  fileName: string;
  size: number;
  isCloudUrl: boolean;
}

/**
 * Sanitize filename for safe storage keys
 */
function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
}

/**
 * Convert dataUrl to Blob for storage upload
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'audio/webm';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Upload an Audio File or Voice Recording to Universal Cloud Media Storage (Firebase Storage)
 * Automatically falls back to local storage if offline or unavailable.
 */
export async function uploadMediaToCloudStorage(
  fileOrData: File | Blob | string,
  fileId: string,
  originalFileName?: string,
  onProgress?: (percent: number) => void
): Promise<MediaUploadResult> {
  const cleanId = fileId.replace(/^indexeddb:/, '');
  let blob: Blob;
  let fileName = originalFileName || `track_${cleanId}.mp3`;
  let mimeType = 'audio/mpeg';

  if (typeof fileOrData === 'string') {
    if (fileOrData.startsWith('data:')) {
      blob = dataUrlToBlob(fileOrData);
      mimeType = blob.type || 'audio/webm';
      if (!originalFileName) {
        fileName = `recording_${cleanId}.${mimeType.includes('webm') ? 'webm' : 'mp3'}`;
      }
    } else {
      // Already an external URL
      return {
        url: fileOrData,
        fileName,
        size: 0,
        isCloudUrl: true,
      };
    }
  } else {
    blob = fileOrData;
    mimeType = blob.type || (blob as File).name?.split('.').pop() || 'audio/mpeg';
    if ((fileOrData as File).name) {
      fileName = (fileOrData as File).name;
    }
  }

  // 1. First, save to local IndexedDB cache for instant zero-latency playback on the current device
  if (typeof fileOrData === 'string' && fileOrData.startsWith('data:')) {
    saveAudioToStorage(cleanId, fileOrData, fileName).catch((err) => {
      console.warn('Local audio cache error:', err);
    });
  } else {
    // Read as DataURL for IndexedDB local caching
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        saveAudioToStorage(cleanId, reader.result, fileName).catch(() => {});
      }
    };
    reader.readAsDataURL(blob);
  }

  // 2. Upload to Firebase Cloud Storage for universal sync across all devices
  try {
    const cleanFileName = sanitizeFileName(fileName);
    const storagePath = `worship_media/${cleanId}_${cleanFileName}`;
    const storageRef = ref(storage, storagePath);

    const metadata = {
      contentType: mimeType,
      customMetadata: {
        originalName: fileName,
        uploadedAt: new Date().toISOString(),
        trackId: cleanId,
      },
    };

    const uploadTask = uploadBytesResumable(storageRef, blob, metadata);

    const downloadUrl = await new Promise<string>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot: UploadTaskSnapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) {
            onProgress(Math.round(progress));
          }
        },
        (error) => {
          console.warn('Firebase Storage upload warning:', error);
          reject(error);
        },
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          } catch (err) {
            reject(err);
          }
        }
      );
    });

    return {
      url: downloadUrl,
      fileName,
      size: blob.size,
      isCloudUrl: true,
    };
  } catch (cloudErr) {
    console.warn('Could not upload to cloud storage, falling back to local storage ID:', cloudErr);
    // Return indexeddb locator so the app continues working offline
    return {
      url: `indexeddb:${cleanId}`,
      fileName,
      size: blob.size,
      isCloudUrl: false,
    };
  }
}

/**
 * Delete a media file from Firebase Cloud Storage
 */
export async function deleteMediaFromCloudStorage(urlOrPath: string): Promise<void> {
  if (!urlOrPath) return;
  if (!urlOrPath.includes('firebasestorage.googleapis.com')) return;

  try {
    const storageRef = ref(storage, urlOrPath);
    await deleteObject(storageRef);
  } catch (err) {
    console.warn('Could not delete file from Firebase Storage:', err);
  }
}
