import { supabase } from '../supabase';
export async function prepareSetlistPreview(setlistId: string, image: File): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error('Please sign in again.');
  if (image.size > 5 * 1024 * 1024) throw new Error('This image is too large for a link preview. Use Share image instead.');
  const response = await fetch('https://qnlbc-media.aigems2026.workers.dev/api/share-setlist', {
    method: 'POST', headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'image/png', 'X-Setlist-Id': setlistId },
    body: image, signal: AbortSignal.timeout(45000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Could not prepare the preview. Please retry.');
  if (typeof result.url !== 'string' || !/^https:\/\/qnlbc-media\.aigems2026\.workers\.dev\/share\/[a-f0-9]{64}$/.test(result.url) || result.size !== image.size) throw new Error('Share preview could not be verified.');
  return result.url;
}
