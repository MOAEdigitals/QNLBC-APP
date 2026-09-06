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

/**
 * Get S3 Client configured for Cloudflare R2 if credentials exist
 */
export function getR2Client(): { client: S3Client; bucketName: string; publicUrl: string } | null {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.trim();
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME?.trim() || 'worship-audio';
  const publicUrl = (
    process.env.CLOUDFLARE_R2_PUBLIC_URL?.trim() ||
    'https://pub-aaa45e93104541548f563b3496acae00.r2.dev'
  ).replace(/\/+$/, '');

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return { client, bucketName, publicUrl };
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

  const r2Config = getR2Client();

  if (r2Config) {
    try {
      const { client, bucketName, publicUrl } = r2Config;
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
      console.error('Cloudflare R2 upload error, falling back to local server storage:', err);
    }
  }

  // Fallback: Save to server filesystem in uploads/ directory
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const localFileName = `${cleanId}_${sanitizedName}`;
  const localFilePath = path.join(uploadsDir, localFileName);
  fs.writeFileSync(localFilePath, fileBuffer);

  return {
    url: `/uploads/${localFileName}`,
    key: localFileName,
    size: fileBuffer.length,
    isCloudUrl: false,
    provider: 'local-server',
  };
}

/**
 * Delete media file
 */
export async function deleteMedia(keyOrUrl: string): Promise<void> {
  const r2Config = getR2Client();
  if (r2Config && keyOrUrl.includes('r2.dev')) {
    try {
      const { client, bucketName } = r2Config;
      const key = keyOrUrl.split('.r2.dev/')[1] || keyOrUrl;
      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      });
      await client.send(command);
    } catch (err) {
      console.warn('Failed to delete from Cloudflare R2:', err);
    }
    return;
  }

  // Local file delete
  if (keyOrUrl.startsWith('/uploads/')) {
    const filename = path.basename(keyOrUrl);
    const localFilePath = path.join(process.cwd(), 'uploads', filename);
    if (fs.existsSync(localFilePath)) {
      try {
        fs.unlinkSync(localFilePath);
      } catch (err) {
        console.warn('Failed to delete local upload:', err);
      }
    }
  }
}
