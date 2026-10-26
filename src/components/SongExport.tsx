import React, { useRef, useState } from 'react';
import { exportAllSongs } from '../services/songExport';
export function SongExport() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const start = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { const count = await exportAllSongs(setStatus); setStatus(`Export ready: ${count} songs. Keep the ZIP in a safe location.`); }
    catch (e) { setStatus(''); setError((e as Error).message || 'Export could not be completed.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <section className="space-y-3 pt-3" aria-label="Songs-only backup"><h4 className="font-semibold">Songs-only backup</h4><p className="text-sm text-slate-500">Export all current songs as a ZIP with lyrics text files and a JSON backup of song details. Media links are included; recordings are available through Full Data Export.</p><button type="button" className="ui-primary" disabled={busy} onClick={() => void start()}>{busy ? 'Exporting songs…' : 'Export all songs'}</button>{status && <p role="status" className="text-sm text-slate-500">{status}</p>}{error && <p role="alert" className="text-sm text-rose-600">{error}</p>}</section>;
}
