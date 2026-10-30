import { supabase } from '../supabase';

const PREVIEW_ORIGIN = 'https://qnlbc-media.aigems2026.workers.dev';

export async function createSetlistPreview(id: string, image: File): Promise<string> {
  if (!/^[0-9a-f-]{36}$/i.test(id) || image.type !== 'image/png' || !image.size || image.size > 3 * 1024 * 1024) throw new Error('The setlist preview image is unavailable or too large.');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error('Please sign in again.');
  const response = await fetch(`${PREVIEW_ORIGIN}/api/share-setlist?setlist=${encodeURIComponent(id)}`, {
    method: 'POST', headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'image/png' }, body: image, signal: AbortSignal.timeout(60000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Could not create the preview link.');
  if (typeof result.url !== 'string' || !new RegExp(`^${PREVIEW_ORIGIN.replaceAll('.', '\\.')}\/share\/[a-f0-9]{64}\/[a-f0-9]{32}(?:\\?v=2)?$`).test(result.url)) throw new Error('The preview link could not be verified.');
  return result.url;
}
