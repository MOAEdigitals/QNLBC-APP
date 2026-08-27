/**
 * Universal Media URL Resolver & Helper Utilities
 * Converts Dropbox, direct audio/video streams, or embed links.
 */

/**
 * Converts Dropbox or direct link to a direct streaming/download URL
 * suitable for HTML5 <audio> and <video> tags.
 */
export function resolveMediaUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();

  // Dropbox Links: replace www.dropbox.com with dl.dropboxusercontent.com
  if (trimmed.includes('dropbox.com')) {
    return trimmed
      .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
      .replace(/[?&]dl=0/g, '?raw=1')
      .replace(/[?&]dl=1/g, '?raw=1');
  }

  return trimmed;
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
 * Determines whether a URL is a video (YouTube or direct video file)
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

