import { supabase } from '../supabase';

export const R2_UPLOAD_ENDPOINT = 'https://qnlbc-media.aigems2026.workers.dev/api/upload-media';
export const R2_PUBLIC_URL = 'https://pub-aaa45e93104541548f563b3496acae00.r2.dev';

export async function mediaHash(blob: Blob): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function uploadVerifiedR2(blob: Blob, fileName: string) {
  if (!blob.size) throw new Error('The recording is empty.');
  if (blob.size > 50 * 1024 * 1024) throw new Error('Maximum file size is 50 MB.');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error('Please sign in again.');
  const hash = await mediaHash(blob);
  const response = await fetch(R2_UPLOAD_ENDPOINT, {
    method: 'POST', headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      'Content-Type': blob.type || 'application/octet-stream',
      'X-File-Name': encodeURIComponent(fileName),
    }, body: blob, signal: AbortSignal.timeout(180000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Recording upload failed.');
  if (!result.success || result.sha256 !== hash || result.size !== blob.size ||
    result.url !== `${R2_PUBLIC_URL}/worship_media/verified/${hash}`) {
    throw new Error('Recording upload could not be verified.');
  }
  return result as { url: string; fileName: string; size: number; sha256: string; isCloudUrl: true; provider: string };
}

// Used before migration changes a database reference, not for every normal upload.
export async function verifyR2Playback(url: string, expectedHash: string) {
  if (url !== `${R2_PUBLIC_URL}/worship_media/verified/${expectedHash}`) throw new Error('Unexpected recording URL.');
  const response = await fetch(url, { signal: AbortSignal.timeout(180000) });
  if (!response.ok || await mediaHash(await response.blob()) !== expectedHash) {
    throw new Error('Downloaded recording does not match the original.');
  }
}
