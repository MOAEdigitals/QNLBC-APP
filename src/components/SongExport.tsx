import React, { useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { exportAllSongs } from '../services/songExport';
export function SongExport() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const start = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { const count = await exportAllSongs(setStatus); setStatus(`Export ready: ${count} songs.`); }
    catch (e) { setStatus(''); setError((e as Error).message || 'Export could not be completed.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <section className="space-y-3" aria-label="Songs-only backup"><h4 className="font-semibold">Songs-only backup</h4><button type="button" className="data-tool-action" disabled={busy} onClick={() => void start()}><span className="data-tool-icon"><Download className="h-5 w-5" /></span><span className="min-w-0"><span className="block font-semibold">{busy ? 'Exporting songs…' : 'Export all songs'}</span><span className="block text-sm text-slate-500">ZIP · Individual TXT files + JSON backup</span></span></button>{status && <p role="status" className="text-sm text-slate-500">{status}</p>}{error && <p role="alert" className="text-sm text-rose-600">{error}</p>}</section>;
}
