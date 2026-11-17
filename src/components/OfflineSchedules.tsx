import { useState } from 'react';
import { PracticeAudioTrackRow } from './PracticeAudioTrackRow';
import { CalendarDays, Mic2, Play, Users } from 'lucide-react';
import { useSwipeSubtabs } from './SwipeNavigation';
import Activities from '../features/activities/Activities';
import type { OfflineLibrary } from '../services/androidOfflineLibrary';
import { resolveItemLyrics } from '../services/supabaseData';
import type { PracticeGroupEntry, Song, SpecialNumbersSubTab, UserAccount } from '../types';

const tabs = [
  { id: 'activities', label: 'Activities', Icon: CalendarDays },
  { id: 'schedules', label: 'Song Numbers', Icon: Mic2 },
  { id: 'choir', label: 'Choir', Icon: Users },
  { id: 'practice', label: 'Practice', Icon: Play },
] as const;

export default function OfflineSchedules({ user, library, songs, collapseSignal }: {
  user: UserAccount;
  library: OfflineLibrary | null;
  songs: Song[];
  collapseSignal?: number;
}) {
  const [tab, setTab] = useSwipeSubtabs<SpecialNumbersSubTab>('special-numbers', 'activities');
  const sections = library?.text;
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const rows = tab === 'schedules'
    ? sections?.songNumbers?.map(row => ({ ...row, title: row.songTitle || row.performerName, detail: row.songTitle ? row.performerName : '', date: row.scheduledDate }))
    : tab === 'choir'
      ? sections?.choir?.map(row => ({ ...row, title: row.songTitle, detail: row.choirGroup, date: row.date }))
      : sections?.practice?.map(row => ({ ...row, title: row.songTitle, detail: [row.groupName, row.assignedEvent, row.practiceTime].filter(Boolean).join(' · '), date: row.practiceDate || row.targetDate }));
  return <div className="space-y-4">
    <div role="group" aria-label="Schedules sections" className="app-subtabs mx-auto flex w-full max-w-[640px] gap-1.5 rounded-2xl border border-slate-200 bg-slate-100 p-1.5 dark:border-slate-700/80 dark:bg-slate-800/90">
      {tabs.map(({ id, label, Icon }) => <button key={id} type="button" className="ui-category-pill app-subtab" aria-pressed={tab === id} onClick={() => { setPlayingTrackId(null); setTab(id); }}>
        <Icon size={16} aria-hidden="true" /><span>{label}</span>
      </button>)}
    </div>
    {tab === 'activities'
      ? <Activities currentUser={user} offlineItems={library?.activities ?? []} birthdays={sections?.birthdays} collapseSignal={collapseSignal} />
      : <div key={tab + ':' + collapseSignal} className="app-subtab-content space-y-2">
        {!rows?.length && <p className="text-sm text-slate-500">{rows ? 'No entries.' : 'Open the app online to save this section.'}</p>}
        {rows?.map(row => {
          const body = [row.detail, row.notes, resolveItemLyrics(row, songs)].filter(Boolean).join('\n\n');
          const heading = <><span className="font-semibold">{row.title}</span>{row.date && <time className="ml-2 text-sm text-slate-500" dateTime={row.date}>{row.date}</time>}</>;
          const practice = tab === 'practice' ? row as PracticeGroupEntry : null;
          const parts = practice?.vocalParts ?? [];
          const tracks = practice?.customAttachments ?? [];
          const hasMixer = !!practice && !!(parts.length || tracks.length);
          return body || hasMixer
            ? <details key={row.id} onToggle={event => {
                if (!event.currentTarget.open) setPlayingTrackId(id => [...parts, ...tracks].some(track => track.id === id) ? null : id);
              }} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <summary className="cursor-pointer">{heading}</summary>
              {hasMixer && <section className="mt-3 space-y-1" aria-label="Audio mixer">
                <h4 className="text-sm font-semibold">Audio mixer</h4>
                {[...parts.map(part => ({ id: part.id, label: part.partLabel, name: part.name || part.partLabel, category: 'vocal_part' as const })),
                  ...tracks.map(track => ({ id: track.id, label: track.category === 'plus_one' ? 'Plus One' : 'Minus One', name: track.name, category: track.category === 'plus_one' ? 'plus_one' as const : 'minus_one' as const })),
                ].map(track => <PracticeAudioTrackRow key={track.id} id={track.id} offline
                  badgeLabel={track.label} badgeCategory={track.category} performerName={track.name}
                  practice={{ accountId: user.id, practiceId: row.id, songTitle: row.title }}
                  isCurrentlyPlaying={playingTrackId === track.id}
                  onPlay={() => setPlayingTrackId(track.id)}
                  onPause={() => setPlayingTrackId(id => id === track.id ? null : id)}
                />)}
              </section>}
              {body && <p className="mt-2 whitespace-pre-wrap break-words">{body}</p>}
            </details>
            : <div key={row.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">{heading}</div>;
        })}
      </div>}
  </div>;
}
