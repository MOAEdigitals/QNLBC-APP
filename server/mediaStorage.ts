import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

export interface StorageUploadResult {
  url: string;
  key: string;
  size: number;
  isCloudUrl: boolean;
  provider: 'cloudflare-r2' | 'local-server';
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();
}

// Configuration for Cloudflare R2 setup
const DEFAULT_ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID?.trim() || '';
const DEFAULT_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME?.trim() || 'worship-audio';
const DEFAULT_PUBLIC_URL = (process.env.CLOUDFLARE_R2_PUBLIC_URL?.trim() || '').replace(/\/+$/, '');

export function getR2Config() {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID?.trim() || DEFAULT_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_R2_API_TOKEN?.trim() || '';
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME?.trim() || DEFAULT_BUCKET_NAME;
  const publicUrl = (
    process.env.CLOUDFLARE_R2_PUBLIC_URL?.trim() ||
    DEFAULT_PUBLIC_URL
  ).replace(/\/+$/, '');

  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.trim() || '';
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.trim() || '';

  return {
    accountId,
    apiToken,
    bucketName,
    publicUrl,
    accessKeyId,
    secretAccessKey,
    hasToken: Boolean(accountId && apiToken),
    hasS3Credentials: Boolean(accountId && accessKeyId && secretAccessKey),
    isConfigured: Boolean((accountId && apiToken) || (accountId && accessKeyId && secretAccessKey)),
  };
}

/**
 * Get S3 Client configured for Cloudflare R2 if S3 credentials exist
 */
export function getR2Client(): { client: S3Client; bucketName: string; publicUrl: string } | null {
  const config = getR2Config();
  if (!config.hasS3Credentials || !config.accessKeyId || !config.secretAccessKey) {
    return null;
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return { client, bucketName: config.bucketName, publicUrl: config.publicUrl };
}

/**
 * Upload a media file directly to Cloudflare R2 or fallback to server disk
 */
export async function uploadMedia(
  fileBuffer: Buffer,
  originalFileName: string,
  mimeType: string,
  fileId: string
): Promise<StorageUploadResult> {
  const cleanId = fileId.replace(/[^a-zA-Z0-9_-]/g, '') || `track_${Date.now()}`;
  const sanitizedName = sanitizeFileName(originalFileName || 'audio_track.mp3');
  const objectKey = `worship_media/${cleanId}_${sanitizedName}`;

  const config = getR2Config();

  // 1. Try Cloudflare REST API with Bearer Token (fast, official, supports direct large uploads)
  if (config.hasToken) {
    try {
      const uploadEndpoint = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/r2/buckets/${config.bucketName}/objects/${encodeURIComponent(objectKey)}`;
      
      const response = await fetch(uploadEndpoint, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${config.apiToken}`,
          'Content-Type': mimeType || 'audio/mpeg',
        },
        body: fileBuffer,
      });

      if (response.ok) {
        const fileUrl = `${config.publicUrl}/${objectKey}`;
        console.log(`[R2 Storage] Uploaded ${sanitizedName} (${fileBuffer.length} bytes) to Cloudflare R2 -> ${fileUrl}`);
        return {
          url: fileUrl,
          key: objectKey,
          size: fileBuffer.length,
          isCloudUrl: true,
          provider: 'cloudflare-r2',
        };
      } else {
        const errText = await response.text();
        console.warn('[R2 Storage] Cloudflare API error response:', response.status, errText);
      }
    } catch (err) {
      console.error('[R2 Storage] Error uploading via Cloudflare API token:', err);
    }
  }

  // 2. Try S3 SDK if S3 credentials configured
  const s3Config = getR2Client();
  if (s3Config) {
    try {
      const { client, bucketName, publicUrl } = s3Config;
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        Body: fileBuffer,
        ContentType: mimeType || 'audio/mpeg',
      });

      await client.send(command);

      const fileUrl = `${publicUrl}/${objectKey}`;
      return {
        url: fileUrl,
        key: objectKey,
        size: fileBuffer.length,
        isCloudUrl: true,
        provider: 'cloudflare-r2',
      };
    } catch (err) {
      console.error('[R2 Storage] S3 upload error:', err);
    }
  }

  if (!config.isConfigured) {
    throw new Error('Cloudflare R2 is not configured on this server. Set CLOUDFLARE_R2_ACCOUNT_ID and CLOUDFLARE_R2_API_TOKEN environment variables.');
  }

  throw new Error('Failed to upload media to Cloudflare R2. Please check server logs and R2 credentials.');
}

/**
 * Delete media file with verified response checking
 */
export async function deleteMedia(keyOrUrl: string): Promise<boolean> {
  const config = getR2Config();
  const isR2Url = keyOrUrl.includes('r2.dev') || keyOrUrl.startsWith('worship_media/');

  if (isR2Url && config.hasToken) {
    try {
      const key = keyOrUrl.includes('.r2.dev/') ? keyOrUrl.split('.r2.dev/')[1] : keyOrUrl;
      const deleteEndpoint = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/r2/buckets/${config.bucketName}/objects/${encodeURIComponent(key)}`;
      const res = await fetch(deleteEndpoint, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${config.apiToken}`,
        },
      });
      if (res.ok || res.status === 404) {
        console.log(`[R2 Storage] Deleted object ${key} from Cloudflare R2 (status ${res.status})`);
        return true;
      } else {
        const text = await res.text();
        console.warn(`[R2 Storage] Cloudflare delete returned HTTP ${res.status}: ${text}`);
        return false;
      }
    } catch (err) {
      console.warn('[R2 Storage] Failed to delete from Cloudflare R2 API:', err);
      return false;
    }
  }

  const s3Config = getR2Client();
  if (s3Config && keyOrUrl.includes('r2.dev')) {
    try {
      const { client, bucketName } = s3Config;
      const key = keyOrUrl.split('.r2.dev/')[1] || keyOrUrl;
      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      });
      await client.send(command);
      return true;
    } catch (err) {
      console.warn('Failed to delete from Cloudflare R2 S3:', err);
      return false;
    }
  }

  // Local file delete
  if (keyOrUrl.startsWith('/uploads/')) {
    const filename = path.basename(keyOrUrl);
    const localFilePath = path.join(process.cwd(), 'uploads', filename);
    if (fs.existsSync(localFilePath)) {
      try {
        fs.unlinkSync(localFilePath);
        return true;
      } catch (err) {
        console.warn('Failed to delete local upload:', err);
        return false;
      }
    }
    return true;
  }

  return false;
}
