/**
 * Universal Media URL Resolver & Helper Utilities
 * Converts Google Drive, Dropbox, YouTube, and cloud URLs to direct playable audio/video streams or embed links.
 */

/**
 * Extracts Google Drive file ID from various Google Drive URL formats:
 * - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 * - https://drive.google.com/file/d/FILE_ID/view
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/uc?id=FILE_ID
 * - https://docs.google.com/file/d/FILE_ID/edit
 * - https://drive.google.com/file/d/FILE_ID
 */
export function extractGoogleDriveFileId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();

  // Pattern 1: /file/d/{id} or /d/{id}
  const fileDMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i) || trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/i);
  if (fileDMatch && fileDMatch[1]) {
    return fileDMatch[1];
  }

  // Pattern 2: id={id} query parameter
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
  if (idMatch && idMatch[1]) {
    return idMatch[1];
  }

  return null;
}

/**
 * Converts a Google Drive link or Dropbox link to a direct streaming/download URL
 * suitable for HTML5 <audio> and <video> tags.
 */
export function resolveMediaUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();

  // 1. Google Drive Links
  if (trimmed.includes('drive.google.com') || trimmed.includes('docs.google.com')) {
    const driveId = extractGoogleDriveFileId(trimmed);
    if (driveId) {
      // Direct streamable Google Drive URL
      return `https://drive.google.com/uc?export=download&id=${driveId}`;
    }
  }

  // 2. Dropbox Links: replace www.dropbox.com with dl.dropboxusercontent.com
  if (trimmed.includes('dropbox.com')) {
    return trimmed
      .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
      .replace(/[?&]dl=0/g, '?raw=1')
      .replace(/[?&]dl=1/g, '?raw=1');
  }

  return trimmed;
}

/**
 * Returns an embeddable URL for Google Drive video/audio files (for <iframe> preview)
 */
export function getGoogleDriveEmbedUrl(rawUrl?: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (trimmed.includes('drive.google.com') || trimmed.includes('docs.google.com')) {
    const driveId = extractGoogleDriveFileId(trimmed);
    if (driveId) {
      return `https://drive.google.com/file/d/${driveId}/preview`;
    }
  }
  return null;
}

/**
 * Extracts YouTube Video ID and returns embed URL
 */
export function getYouTubeEmbedUrl(url?: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? `https://www.youtube.com/embed/${match[2]}?autoplay=1` : null;
}

/**
 * Determines whether a URL is a video (YouTube, Google Drive preview, or direct video file)
 */
export function isVideoUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return (
    lower.startsWith('data:video/') ||
    lower.includes('youtube.com') ||
    lower.includes('youtu.be') ||
    lower.endsWith('.mp4') ||
    lower.endsWith('.webm') ||
    lower.endsWith('.mov') ||
    lower.endsWith('.mkv')
  );
}
