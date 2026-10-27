import React, { useEffect, useMemo, useState } from 'react';
import type { Song } from '../../types';
import { useDownloads, useLocalSongPlayback } from './useDownloads';
import { readDownloadedSongs } from './storage';
import { localSongStats, songFileSources, sourceKey, formatFileSize } from './model';
import { DownloadControls } from './DownloadControls';

/** Read-only Songs view for a cold launch without a network connection. */
export default function OfflineSongs() {
  const downloads = useDownloads();
  const [songs, setSongs] = useState<Song[]>([]), [error, setError] = useState('');
  const [query, setQuery] = useState(''), [sort, setSort] = useState('title');
  const [selected, setSelected] = useState(''), [media, setMedia] = useState<{ url: string; type: string } | null>(null);
  const [font, setFont] = useState(18);
  const playback = useLocalSongPlayback(media, downloads);
  useEffect(() => { let alive = true; void readDownloadedSongs().then(rows => { if (alive) setSongs(rows); }).catch(error => { if (alive) setError((error as Error).message); }); return () => { alive = false; }; }, []);
  const visible = useMemo(() => songs.filter(song => localSongStats(song, downloads.items).count && `${song.title}\n${song.lyrics}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => {
    const first = localSongStats(a, downloads.items), second = localSongStats(b, downloads.items);
    return (sort === 'recent' ? second.latest.localeCompare(first.latest) : sort === 'size' ? second.size - first.size : 0) || a.title.localeCompare(b.title);
  }), [songs, downloads.items, query, sort]);
  return <div className="qnlbc-app min-h-dvh bg-white text-slate-900 dark:bg-slate-950 dark:text-white">
    <header data-app-header className="sticky top-0 z-40 border-b border-slate-200 bg-white pt-[var(--app-safe-top)] dark:border-slate-800 dark:bg-slate-950"><div className="mx-auto max-w-4xl space-y-2 px-4 py-3">
      <div className="flex items-center justify-between"><h1 className="text-xl font-bold">Songs · Offline</h1><button type="button" className="ui-secondary" onClick={() => window.location.reload()}>Reconnect</button></div>
      <p className="text-xs text-slate-500">Local files and saved lyrics on this device</p>
      <input type="search" aria-label="Search local songs" placeholder="Search local songs" className="min-h-11 w-full rounded-xl border border-slate-300 bg-transparent px-3 dark:border-slate-700" value={query} onChange={event => setQuery(event.target.value)} />
      <select aria-label="Sort local songs" className="min-h-11 rounded-xl bg-slate-100 px-3 dark:bg-slate-800" value={sort} onChange={event => setSort(event.target.value)}><option value="title">Title A–Z</option><option value="recent">Recently downloaded</option><option value="size">File size: largest first</option></select>
    </div></header>
    <main className="mx-auto max-w-4xl space-y-3 p-4">
      {(error || downloads.error) && <p role="alert" className="text-rose-600">{error || downloads.error}</p>}
      {!downloads.ready && <p role="status">Opening local files…</p>}
      {downloads.ready && !visible.length && <p>No downloaded songs found. Connect to the internet and download a track from Songs first.</p>}
      {visible.map(song => <article key={song.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
        <button type="button" className="min-h-11 w-full text-left font-bold" aria-expanded={selected === song.id} onClick={() => { setSelected(selected === song.id ? '' : song.id); setMedia(null); }}>{song.title} <span className="text-xs font-normal text-slate-500">{formatFileSize(localSongStats(song, downloads.items).size)}</span></button>
        {selected === song.id && <>
          <div className="my-2 flex gap-2"><button className="ui-secondary" aria-label="Smaller lyrics" onClick={() => setFont(value => Math.max(14, value - 2))}>A−</button><button className="ui-secondary" aria-label="Larger lyrics" onClick={() => setFont(value => Math.min(36, value + 2))}>A+</button></div>
          <div className="whitespace-pre-wrap py-3 leading-relaxed" style={{ fontSize: font }}>{song.lyrics}</div>
          {media && (playback.loading ? <p role="status">Opening local track…</p> : playback.error ? <p role="alert">{playback.error}</p> : playback.type === 'audio' ? <audio key={playback.url} src={playback.url} controls autoPlay className="my-3 w-full" /> : <video key={playback.url} src={playback.url} controls autoPlay playsInline className="my-3 max-h-80 w-full rounded-xl bg-black" />)}
          {songFileSources(song).filter(source => downloads.items.some(file => file.sourceKey === sourceKey(source.url))).map((source, index) => <div key={`${source.url}-${index}`} className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-2 dark:border-slate-700"><button className="min-h-11 text-left text-sm font-semibold" onClick={() => setMedia({ url: source.url, type: source.type })}>Play {source.title}</button><DownloadControls source={source} /></div>)}
        </>}
      </article>)}
    </main>
  </div>;
}
