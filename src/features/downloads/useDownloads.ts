import { useEffect, useState, useSyncExternalStore } from 'react';
import { getDownloadSnapshot, subscribeDownloads, refreshDownloads, openLocalSongFile } from './service';
import { sourceKey } from './model';

export function useDownloads() {
  const snapshot = useSyncExternalStore(subscribeDownloads, getDownloadSnapshot);
  useEffect(() => { void refreshDownloads(); const refresh = () => { void refreshDownloads(); }; window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh); }, []);
  return snapshot;
}
export function useLocalSongPlayback(source: { url: string; type: string } | null, downloads: ReturnType<typeof useDownloads>) {
  const key = source ? sourceKey(source.url) : null;
  const record = downloads.items.find(item => item.sourceKey === key);
  const [local, setLocal] = useState<{ key: string; url: string; error?: string } | null>(null);
  useEffect(() => {
    let alive = true, release = () => {};
    setLocal(null);
    if (record) void openLocalSongFile(record).then(result => {
      if (!alive) { result.release(); return; }
      release = result.release; setLocal({ key: record.id, url: result.url });
    }).catch(error => { if (alive) setLocal({ key: record.id, url: '', error: (error as Error).message }); });
    return () => { alive = false; release(); };
  }, [record?.id, record?.downloadedAt]);
  return {
    url: record ? local?.key === record.id ? local.url : '' : source?.url || '',
    type: record?.type || source?.type || 'link',
    isLocal: !!record,
    loading: !!source && (!downloads.ready || (!!record && local?.key !== record.id)),
    error: record && local?.key === record.id ? local.error : undefined,
  };
}
