import { UpcomingBadge } from './UpcomingBadge';
import React, { forwardRef } from 'react';
import { User } from 'lucide-react';
import type { Setlist, Song, SetlistSongItem } from '../types';
import { CardDate } from './CardDate';
import { getPersonColor } from '../utils/personColors';
import { setlistTitle } from '../utils/setlistSharing';

function Person({ role, name }: { role: string; name?: string }) {
  return <div className="flex items-center gap-3 min-w-0"><User aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-400" /><div className="min-w-0 flex-1"><div className="text-sm text-slate-500 dark:text-slate-400">{role}</div><div className={`text-base font-bold break-words ${getPersonColor(name).textBold}`}>{name || 'Unassigned'}</div></div></div>;
}
/** A noninteractive, mobile-width export. It never changes the live accordion state. */
export const SetlistShareCard = forwardRef<HTMLDivElement, { item: Setlist; songs: Song[]; badge?: string; highlighted?: boolean }>(function SetlistShareCard({ item, songs, badge, highlighted = false }, ref) {
  const title = (text: string, id?: string) => songs.find(song => song.id === id)?.title || text;
  const section = (label: string, leader: string | undefined, entries: SetlistSongItem[], theme?: string) => <section className="border-t border-slate-300/60 dark:border-slate-600/60 pt-4 space-y-3">
    <Person role={label} name={leader} />
    <div className="space-y-2">{[...entries.filter(song => song.title.trim()).map(song => `${title(song.title, song.songId || song.song_id)}${song.keyNote || song.key_note ? ` (${song.keyNote || song.key_note})` : ''}`), ...(theme ? [`${theme} (Theme Song)`] : [])].map((text, index) => <div key={index} className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white/80 dark:bg-slate-900 px-3 py-2 text-sm leading-relaxed break-words">{index + 1}. {text}</div>)}</div>
  </section>;
  const sunday = !item.type || item.type === 'sunday';
  const dark = document.documentElement.classList.contains('dark');
  return <div ref={ref} data-share-card className="w-[390px] rounded-2xl border border-slate-300 dark:border-slate-500 p-4 space-y-4 text-slate-900 dark:text-slate-100" style={{ background: highlighted ? dark ? 'linear-gradient(115deg, #192d46, #244033)' : 'linear-gradient(115deg, #dfedff, #e7f1e8)' : dark ? '#0f172a' : '#ffffff' }}>
    <header className="flex gap-3 items-center"><CardDate date={item.date} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold break-words flex-1">{setlistTitle(item)}</h2>{badge && <UpcomingBadge status={badge === 'Today' ? 'today' : badge === 'Next up' ? 'next-up' : 'upcoming'} />}</div><p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{[item.presider, sunday ? item.sundaySchool?.songLeader : item.program?.songLeader, sunday ? item.worshipService?.songLeader : undefined].filter(Boolean).join(' · ')}</p></div></header>
    {item.type !== 'prayer_meeting' && <section className="space-y-3 border-t border-slate-300/60 dark:border-slate-600/60 pt-4"><Person role="Presider" name={item.presider} /><div className="flex flex-wrap gap-2">{[['Welcome', item.welcomeSong], ['Closing', item.closingSong]].filter(([, song]) => song).map(([label, song]) => <div key={label} className="flex-1 min-w-[140px] rounded-lg bg-white/80 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-xs break-words"><span className="text-slate-500 dark:text-slate-400">{label}: </span>{song}</div>)}</div></section>}
    {sunday ? <>{section('Sunday School', item.sundaySchool?.songLeader, item.sundaySchool?.songs || [])}{section('Worship Service', item.worshipService?.songLeader, item.worshipService?.songs || [], item.themeSong)}</> : section('Song Leader', item.program?.songLeader, item.program?.songs || [], item.themeSong)}
    <footer className="border-t border-slate-300/60 dark:border-slate-600/60 pt-3 text-xs text-slate-500 dark:text-slate-400">QNLBC · {new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</footer>
  </div>;
});
