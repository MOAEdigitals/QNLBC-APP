import { saveAudioToStorage, getAudioFromStorage } from '../utils/audioStorage';
import { uploadVerifiedR2 } from './r2Media';

export interface MediaUploadResult {
  url: string; fileName: string; size: number; isCloudUrl: boolean; provider?: string; error?: string;
}
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

export async function uploadMediaToCloudStorage(
  fileOrData: File | Blob | string, fileId: string, originalFileName?: string,
  onProgress?: (percent: number) => void
): Promise<MediaUploadResult> {
  const cleanId = fileId.replace(/^indexeddb:/, '');
  const fileName = originalFileName || (typeof fileOrData !== 'string' && (fileOrData as File).name) || `recording_${cleanId}.webm`;
  if (typeof fileOrData === 'string' && /^https?:\/\//.test(fileOrData)) {
    return { url: fileOrData, fileName, size: 0, isCloudUrl: true };
  }
  if (typeof fileOrData === 'string' && !fileOrData.startsWith('data:')) throw new Error('Recording data is unavailable.');
  const blob = typeof fileOrData === 'string' ? await dataUrlToBlob(fileOrData) : fileOrData;
  if (typeof fileOrData === 'string') void saveAudioToStorage(cleanId, fileOrData, fileName);
  onProgress?.(10);
  const result = await uploadVerifiedR2(blob, fileName);
  onProgress?.(100);
  return result;
}
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

// Shared immutable media may be referenced by several records. Removing an
// attachment only removes its database reference; retained objects support recovery.
export async function deleteMediaFromCloudStorage(_urlOrPath: string): Promise<boolean> {
  return false;
}