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
      const jsonRes = await fetch('/api/upload-media', {
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

  // Upload to Cloud Media Storage via /api/upload-media with retries
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
