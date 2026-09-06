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

/**
 * Convert dataUrl to Blob safely using browser native fetch or fallback
 */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  try {
    const res = await fetch(dataUrl);
    return await res.blob();
  } catch {
    const arr = dataUrl.split(',');
    const mime = arr[0]?.match(/:(.*?);/)?.[1] || 'audio/mpeg';
    const bstr = atob(arr[1] || '');
    const u8arr = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) {
      u8arr[i] = bstr.charCodeAt(i);
    }
    return new Blob([u8arr], { type: mime });
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
  let blob: Blob;
  let fileName = originalFileName || `track_${cleanId}.mp3`;
  let mimeType = 'audio/mpeg';

  if (typeof fileOrData === 'string') {
    if (fileOrData.startsWith('data:')) {
      blob = await dataUrlToBlob(fileOrData);
      mimeType = blob.type || 'audio/mpeg';
      if (!originalFileName) {
        fileName = `recording_${cleanId}.${mimeType.includes('webm') ? 'webm' : 'mp3'}`;
      }
    } else {
      // Already an external URL (e.g. YouTube, external MP3 link, or existing R2 link)
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

  // 1. Immediately cache to local IndexedDB for zero-latency playback on the current device
  if (typeof fileOrData === 'string' && fileOrData.startsWith('data:')) {
    saveAudioToStorage(cleanId, fileOrData, fileName).catch((err) => {
      console.warn('Local audio cache error:', err);
    });
  } else {
    // Read as DataURL for offline IndexedDB cache
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        saveAudioToStorage(cleanId, reader.result, fileName).catch(() => {});
      }
    };
    reader.readAsDataURL(blob);
  }

  // Helper for single upload attempt with timeout
  const performUpload = (currentBlob: Blob, curFileName: string, curId: string): Promise<MediaUploadResult> => {
    return new Promise<MediaUploadResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload-media', true);
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

  // 2. Upload to Cloud Media Storage via /api/upload-media (Cloudflare R2) with 1 auto-retry
  try {
    return await performUpload(blob, fileName, cleanId);
  } catch (firstErr) {
    console.warn('[Cloud Upload] First attempt failed, retrying once...', firstErr);
    try {
      return await performUpload(blob, fileName, cleanId);
    } catch (retryErr: any) {
      console.warn('[Cloud Upload] Retry failed, falling back to local IndexedDB ID:', retryErr);
      return {
        url: `indexeddb:${cleanId}`,
        fileName,
        size: blob.size,
        isCloudUrl: false,
        error: retryErr?.message || String(retryErr),
      };
    }
  }
}

/**
 * Upload an existing IndexedDB audio recording directly to Cloudflare R2
 * Returns the permanent public Cloud URL if successful, or null if audio not found / failed.
 */
export async function syncLocalAudioToCloud(
  audioId: string,
  customTitle?: string,
  onProgress?: (percent: number) => void
): Promise<string | null> {
  const cleanId = audioId.replace(/^indexeddb:/, '');
  const localData = await getAudioFromStorage(cleanId);
  if (!localData || !localData.startsWith('data:')) {
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
 * Delete a media file from Cloud Media Storage
 */
export async function deleteMediaFromCloudStorage(urlOrPath: string): Promise<void> {
  if (!urlOrPath) return;
  try {
    await fetch(`/api/upload-media?url=${encodeURIComponent(urlOrPath)}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('Could not delete media file from storage:', err);
  }
}
