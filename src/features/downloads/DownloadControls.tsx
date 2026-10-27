import React, { useState } from 'react';
import { Download, Check, Loader2, Trash2, X } from 'lucide-react';
import { type SongFileSource, canDownload, sourceKey, formatFileSize } from './model';
import { type DownloadJob, downloadSongFile, cancelSongDownload, removeSongDownload } from './service';
import { useDownloads } from './useDownloads';

export function DownloadControls({ source }: { source: SongFileSource }) {
  const downloads = useDownloads();
  const [error, setError] = useState(''), [removing, setRemoving] = useState(false);
  const key = sourceKey(source.url), file = downloads.items.find(file => file.sourceKey === key);
  const job: DownloadJob | undefined = key ? downloads.jobs[key] : undefined;
  if (!canDownload(source)) return null;
  return <div className="max-w-full shrink-0 text-right" onClick={event => event.stopPropagation()}>
    <div className="flex items-center justify-end gap-1">
      {file ? <><span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><Check className="h-4 w-4" />Downloaded · {formatFileSize(file.size)}</span><button type="button" disabled={removing} aria-label={`Remove local file ${source.title}`} title="Remove local file" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700" onClick={() => {
        if (!window.confirm('Remove this downloaded copy from this device? The original attachment will remain.')) return;
        setRemoving(true); setError(''); void removeSongDownload(file).catch(error => setError((error as Error).message)).finally(() => setRemoving(false));
      }}><Trash2 className="h-4 w-4" /></button></> : job?.running ? <button type="button" aria-label={`Cancel download ${source.title}`} className="flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs" onClick={() => { if (key) void cancelSongDownload(key).catch(error => setError((error as Error).message)); }}><Loader2 className="h-4 w-4 animate-spin" />{job.progress}%<X className="h-4 w-4" /></button> : <button type="button" disabled={!downloads.ready || !!downloads.error} aria-label={`Download ${source.title}`} className="flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:text-blue-300 dark:hover:bg-slate-700" onClick={() => { setError(''); void downloadSongFile(source).catch(error => setError((error as Error).message)); }}><Download className="h-4 w-4" />{job?.error ? 'Retry' : 'Download'}</button>}
    </div>
    {(error || job?.error) && <p role="alert" className="max-w-64 whitespace-normal text-left text-xs text-rose-600 dark:text-rose-400">{error || job?.error}</p>}
  </div>;
}
