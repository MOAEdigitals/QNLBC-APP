// Universal Cloud Media Storage Service (Cloudflare R2 & Server Storage)
// Allows all church members to upload audio/media (>1MB, MP3s, WAV, voice recordings)
// and have them instantly streamable and synced across all devices without personal Google logins.

import { saveAudioToStorage } from '../utils/audioStorage';

export interface MediaUploadResult {
  url: string;
  fileName: string;
  size: number;
  isCloudUrl: boolean;
  provider?: string;
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
 * Upload an Audio File or Voice Recording to Universal Cloud Media Storage (Cloudflare R2)
 * Supports full MP3 minus-ones, vocal stems, and choir practice tracks (>1MB, up to 50MB).
 * Automatically caches to IndexedDB for local offline capability.
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
      // Already an external URL (e.g. YouTube, external MP3 link)
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
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        saveAudioToStorage(cleanId, reader.result, fileName).catch(() => {});
      }
    };
    reader.readAsDataURL(blob);
  }

  // 2. Upload to Cloud Media Storage via /api/upload-media (Cloudflare R2)
  try {
    const formData = new FormData();
    formData.append('file', blob, fileName);
    formData.append('fileId', cleanId);
    formData.append('fileName', fileName);

    const uploadResponse = await new Promise<MediaUploadResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload-media', true);

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const json = JSON.parse(xhr.responseText);
            if (json.success && json.url) {
              resolve({
                url: json.url,
                fileName: json.fileName || fileName,
                size: json.size || blob.size,
                isCloudUrl: Boolean(json.isCloudUrl),
                provider: json.provider,
              });
            } else {
              reject(new Error(json.error || 'Upload failed'));
            }
          } catch (err) {
            reject(err);
          }
        } else {
          reject(new Error(`Server upload returned status ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during media upload'));
      };

      xhr.send(formData);
    });

    return uploadResponse;
  } catch (cloudErr) {
    console.warn('Could not upload to cloud media storage, falling back to local storage ID:', cloudErr);
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
