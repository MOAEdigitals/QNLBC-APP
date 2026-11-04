import React, { useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { exportAllSongs } from '../services/songExport';
export function SongExport() {
  const lock = useRef(false);
  const [busy, setBusy] = useState<'backup' | 'freeshow' | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const start = async (format: 'backup' | 'freeshow') => {
    if (lock.current) return;
    lock.current = true; setBusy(format); setError('');
    try { const count = await exportAllSongs(setStatus, format); setStatus(`Export ready: ${count} songs.`); }
    catch (e) { setStatus(''); setError((e as Error).message || 'Export could not be completed.'); }
    finally { lock.current = false; setBusy(null); }
  };
  return <section className="space-y-3" aria-label="Songs-only backup"><h4 className="font-semibold">Songs-only backup</h4><button type="button" className="data-tool-action" disabled={busy !== null} onClick={() => void start('backup')}><span className="data-tool-icon"><Download className="h-5 w-5" /></span><span className="min-w-0"><span className="block font-semibold">{busy === 'backup' ? 'Exporting songs…' : 'Export all songs'}</span><span className="block text-sm text-slate-500">ZIP · Individual TXT files + JSON backup</span></span></button><button type="button" className="data-tool-action" disabled={busy !== null} onClick={() => void start('freeshow')}><span className="data-tool-icon"><Download className="h-5 w-5" /></span><span className="min-w-0"><span className="block font-semibold">{busy === 'freeshow' ? 'Exporting for FreeShow…' : 'Export all songs for FreeShow'}</span><span className="block text-sm text-slate-500">ZIP · FreeShow TXT files</span></span></button>{status && <p role="status" className="text-sm text-slate-500">{status}</p>}{error && <p role="alert" className="text-sm text-rose-600">{error}</p>}</section>;
}
