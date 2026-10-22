import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toBlob } from 'html-to-image';
import { X, Share2, Copy, Download } from 'lucide-react';
import type { Setlist, Song } from '../types';
import { SetlistShareCard } from './SetlistShareCard';
import { setlistShareUrl, setlistTitle } from '../utils/setlistSharing';
import { shareSetlistContent, canShareSetlistImage } from '../services/setlistShare';
import { useBackLayer } from '../hooks/useBackLayer';

export function SetlistShareDialog({ item, songs, badge, highlighted, onClose }: { item: Setlist; songs: Song[]; badge?: string; highlighted?: boolean; onClose: () => void }) {
  const card = useRef<HTMLDivElement>(null), close = useRef<HTMLButtonElement>(null);
  const [image, setImage] = useState<{ file: File; url: string } | null>(null);
  const [preparing, setPreparing] = useState(true), [sharing, setSharing] = useState(false);
  const [message, setMessage] = useState('');
  const url = setlistShareUrl(item.id), title = `${setlistTitle(item)} · ${item.date}`;
  const includesImage = image && canShareSetlistImage(title, url, image.file);
  useBackLayer(true, () => { if (!sharing) onClose(); });
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus({ preventScroll: true });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; previous?.focus?.({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    let cancelled = false, objectUrl: string | undefined;
    setPreparing(true); setImage(null); setMessage('');
    void (async () => {
      await document.fonts?.ready;
      if (!card.current || cancelled) return;
      const blob = await toBlob(card.current, { pixelRatio: 2, preferredFontFormat: 'truetype' });
      if (!blob) throw new Error('The image could not be prepared.');
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setImage({ file: new File([blob], `qnlbc-setlist-${item.id}.png`, { type: 'image/png' }), url: objectUrl });
    })().catch(() => { if (!cancelled) setMessage('Image unavailable. You can still share or copy the setlist link.'); })
      .finally(() => { if (!cancelled) setPreparing(false); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [item, songs, badge, highlighted]);
  const share = async () => {
    setSharing(true); setMessage('');
    try {
      const result = await shareSetlistContent(title, url, image?.file);
      if (result === 'unsupported') setMessage('Use Copy link and Download image, then attach them in Messenger.');
    } catch { setMessage('Sharing could not open. You can use Copy link and Download image instead.'); }
    finally { setSharing(false); }
  };
  return createPortal(<div className="fixed inset-0 z-[250] bg-black/60 flex items-center justify-center p-3" onClick={event => { if (event.target === event.currentTarget && !sharing) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby="share-setlist-title" className="w-full max-w-md max-h-[90dvh] flex flex-col rounded-2xl bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-2xl" onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); if (!sharing) onClose(); }
      if (event.key === 'Tab') {
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input, a')];
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
      <header className="flex items-center justify-between p-4"><h2 id="share-setlist-title" className="text-lg font-semibold">Share setlist</h2><button ref={close} type="button" aria-label="Close share preview" disabled={sharing} onClick={onClose} className="h-11 w-11 flex items-center justify-center"><X className="h-5 w-5" /></button></header>
      <div className="overflow-y-auto min-h-0 px-4 pb-4 space-y-3">
        {image ? <img src={image.url} alt={`Expanded ${setlistTitle(item)} for ${item.date}`} className="w-full rounded-2xl" /> : <p className="py-8 text-center text-sm text-slate-500" role="status">{preparing ? 'Preparing setlist image…' : 'Setlist link ready'}</p>}
        <p className="text-sm text-slate-500 dark:text-slate-400">{image && !includesImage ? 'This browser shares links only. Download the image to attach the card in Messenger.' : 'Choose Messenger in the share sheet. If the image arrives without its link, use Copy link and paste it in the chat.'}</p>
        <input aria-label="Setlist link" readOnly value={url} onFocus={event => event.currentTarget.select()} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 p-3 text-xs bg-transparent" />
        {message && <p role="status" className="text-sm text-sky-700 dark:text-sky-300">{message}</p>}
      </div>
      <footer className="border-t border-slate-200 dark:border-slate-800 p-4 space-y-2">
        <button type="button" onClick={share} disabled={preparing || sharing} className="w-full rounded-xl bg-blue-700 text-white px-4 min-h-11 flex items-center justify-center gap-2 disabled:opacity-50"><Share2 className="h-4 w-4" />{sharing ? 'Opening share sheet…' : includesImage ? 'Share image & link' : 'Share link'}</button>
        <div className="flex gap-2"><button type="button" className="min-h-11 flex-1 rounded-xl border border-slate-300 dark:border-slate-700 flex items-center justify-center gap-2 text-sm" onClick={async () => { try { await navigator.clipboard.writeText(url); setMessage('Link copied.'); } catch { setMessage('Select the link above and copy it.'); } }}><Copy className="h-4 w-4" />Copy link</button>{image && <a href={image.url} download={image.file.name} className="min-h-11 flex-1 rounded-xl border border-slate-300 dark:border-slate-700 flex items-center justify-center gap-2 text-sm"><Download className="h-4 w-4" />Download image</a>}</div>
      </footer>
    </div>
    <div aria-hidden="true" className="pointer-events-none fixed top-0 -left-[10000px]"><SetlistShareCard ref={card} item={item} songs={songs} badge={badge} highlighted={highlighted} /></div>
  </div>, document.body);
}
