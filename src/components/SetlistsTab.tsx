import React, { useState } from 'react';
import { Setlist, Song, SetlistSongItem } from '../types';
import {
  formatDateStr,
  isPastDate,
  isToday,
  getNextSundayStr,
  sortUpcomingFirst,
} from '../utils/dateUtils';
import {
  Calendar,
  Plus,
  User,
  Music,
  ChevronRight,
  Sparkles,
  Search,
  Copy,
  Check,
  Edit3,
  Trash2,
  ExternalLink,
  BookOpen,
  ArrowLeft,
  X,
  FileText,
} from 'lucide-react';

interface SetlistsTabProps {
  setlists: Setlist[];
  songs: Song[];
  onSaveSetlist: (setlist: Setlist) => void;
  onDeleteSetlist: (id: string) => void;
  onOpenSongDetail: (songId: string) => void;
  selectedSetlistId?: string | null;
  onClearSelectedSetlistId?: () => void;
}

export const SetlistsTab: React.FC<SetlistsTabProps> = ({
  setlists,
  songs,
  onSaveSetlist,
  onDeleteSetlist,
  onOpenSongDetail,
  selectedSetlistId,
  onClearSelectedSetlistId,
}) => {
  const [activeSetlistId, setActiveSetlistId] = useState<string | null>(selectedSetlistId || null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingSetlist, setEditingSetlist] = useState<Partial<Setlist> | null>(null);
  const [nameSearchQuery, setNameSearchQuery] = useState('');
  const [copiedStatus, setCopiedStatus] = useState(false);

  // Sync external selected ID if provided
  React.useEffect(() => {
    if (selectedSetlistId) {
      setActiveSetlistId(selectedSetlistId);
    }
  }, [selectedSetlistId]);

  // Sort setlists: upcoming first (nearest future/today), then past descending
  const sortedSetlists = sortUpcomingFirst<Setlist>(setlists, (s: Setlist) => s.date);

  // Filtered by person name search
  const filteredSetlists = sortedSetlists.filter((s: Setlist) => {
    if (!nameSearchQuery.trim()) return true;
    const query = nameSearchQuery.toLowerCase().trim();
    const presiderMatch = s.presider.toLowerCase().includes(query);
    const ssLeaderMatch = s.sundaySchool.songLeader.toLowerCase().includes(query);
    const wsLeaderMatch = s.worshipService.songLeader.toLowerCase().includes(query);
    const songMatch =
      s.sundaySchool.songs.some((song: SetlistSongItem) => song.title.toLowerCase().includes(query)) ||
      s.worshipService.songs.some((song: SetlistSongItem) => song.title.toLowerCase().includes(query));
    return presiderMatch || ssLeaderMatch || wsLeaderMatch || songMatch;
  });

  const activeSetlist = setlists.find((s) => s.id === activeSetlistId);

  const handleStartCreate = () => {
    const nextSunday = getNextSundayStr();
    setEditingSetlist({
      id: `setlist-${Date.now()}`,
      date: nextSunday,
      presider: '',
      sundaySchool: {
        songLeader: '',
        songs: [
          { id: `ss-1-${Date.now()}`, title: '', keyNote: '' },
          { id: `ss-2-${Date.now()}`, title: '', keyNote: '' },
        ],
        notes: '',
      },
      worshipService: {
        songLeader: '',
        songs: [
          { id: `ws-1-${Date.now()}`, title: '', keyNote: '' },
          { id: `ws-2-${Date.now()}`, title: '', keyNote: '' },
          { id: `ws-3-${Date.now()}`, title: '', keyNote: '' },
        ],
        notes: '',
      },
      generalNotes: '',
    });
    setIsEditing(true);
  };

  const handleStartEdit = (setlist: Setlist) => {
    setEditingSetlist(JSON.parse(JSON.stringify(setlist)));
    setIsEditing(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSetlist || !editingSetlist.date) return;

    // Filter out empty song titles
    const ssSongs = (editingSetlist.sundaySchool?.songs || []).filter((s) => s.title.trim() !== '');
    const wsSongs = (editingSetlist.worshipService?.songs || []).filter((s) => s.title.trim() !== '');

    const finalSetlist: Setlist = {
      id: editingSetlist.id || `setlist-${Date.now()}`,
      date: editingSetlist.date,
      presider: editingSetlist.presider?.trim() || 'TBA',
      sundaySchool: {
        songLeader: editingSetlist.sundaySchool?.songLeader?.trim() || 'TBA',
        songs: ssSongs.length > 0 ? ssSongs : [{ id: `ss-1`, title: 'Song 1' }, { id: `ss-2`, title: 'Song 2' }],
        notes: editingSetlist.sundaySchool?.notes?.trim() || '',
      },
      worshipService: {
        songLeader: editingSetlist.worshipService?.songLeader?.trim() || 'TBA',
        songs: wsSongs.length > 0 ? wsSongs : [{ id: `ws-1`, title: 'Worship Song 1' }, { id: `ws-2`, title: 'Worship Song 2' }],
        notes: editingSetlist.worshipService?.notes?.trim() || '',
      },
      generalNotes: editingSetlist.generalNotes?.trim() || '',
      createdAt: editingSetlist.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveSetlist(finalSetlist);
    setIsEditing(false);
    setActiveSetlistId(finalSetlist.id);
  };

  const handleCopyBulletin = (setlist: Setlist) => {
    const formatted = `📅 NEW LIFE BAPTIST CHURCH - SUNDAY PROGRAM
Date: ${formatDateStr(setlist.date, { showDayOfWeek: true })}
Presider: ${setlist.presider}

📖 SUNDAY SCHOOL (9:00 AM)
Song Leader: ${setlist.sundaySchool.songLeader}
Songs:
${setlist.sundaySchool.songs.map((s, i) => `  ${i + 1}. ${s.title}${s.keyNote ? ` (${s.keyNote})` : ''}`).join('\n')}
${setlist.sundaySchool.notes ? `Notes: ${setlist.sundaySchool.notes}\n` : ''}
🙌 WORSHIP SERVICE (10:15 AM)
Song Leader: ${setlist.worshipService.songLeader}
Songs:
${setlist.worshipService.songs.map((s, i) => `  ${i + 1}. ${s.title}${s.keyNote ? ` (${s.keyNote})` : ''}`).join('\n')}
${setlist.worshipService.notes ? `Notes: ${setlist.worshipService.notes}\n` : ''}
${setlist.generalNotes ? `\n📌 Announcements/Notes: ${setlist.generalNotes}` : ''}
`;

    navigator.clipboard.writeText(formatted);
    setCopiedStatus(true);
    setTimeout(() => setCopiedStatus(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Sunday Setlists</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Sunday School & Worship Service song orders, presiders, and leaders
          </p>
        </div>

        <button
          id="btn-create-setlist"
          onClick={handleStartCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold hover:bg-slate-800 dark:hover:bg-white transition-all shadow-sm shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create Setlist</span>
        </button>
      </div>

      {/* Role / Name Checker Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={nameSearchQuery}
          onChange={(e) => setNameSearchQuery(e.target.value)}
          placeholder="Check my role / search presider, song leader, or song title..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 transition-colors"
        />
        {nameSearchQuery && (
          <button
            onClick={() => setNameSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Active Detail View Modal / Overlay */}
      {activeSetlist && !isEditing && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 p-5 sm:p-6 shadow-md space-y-6">
          <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setActiveSetlistId(null);
                    onClearSelectedSetlistId?.();
                  }}
                  className="p-1 -ml-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
                  title="Back to list"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  {formatDateStr(activeSetlist.date, { showDayOfWeek: true })}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1.5 ml-7">
                {isToday(activeSetlist.date) ? (
                  <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-500 text-white">
                    Today
                  </span>
                ) : !isPastDate(activeSetlist.date) ? (
                  <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300">
                    Upcoming Sunday
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    Past Service
                  </span>
                )}
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Presider: <strong className="text-slate-800 dark:text-slate-200">{activeSetlist.presider}</strong>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopyBulletin(activeSetlist)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                title="Copy Program Text"
              >
                {copiedStatus ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span className="hidden sm:inline">{copiedStatus ? 'Copied!' : 'Copy Text'}</span>
              </button>
              <button
                onClick={() => handleStartEdit(activeSetlist)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
                <span className="hidden sm:inline">Edit</span>
              </button>
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to delete this setlist?')) {
                    onDeleteSetlist(activeSetlist.id);
                    setActiveSetlistId(null);
                  }
                }}
                className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-medium cursor-pointer"
                title="Delete Setlist"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 2-Part Grid: Sunday School & Worship Service */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Part 1: Sunday School */}
            <div className="p-4 sm:p-5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-700">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Part 1 (9:00 AM)
                  </span>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">Sunday School</h4>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">Song Leader</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {activeSetlist.sundaySchool.songLeader}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-2">
                  Song Order ({activeSetlist.sundaySchool.songs.length} songs):
                </span>
                <div className="space-y-2">
                  {activeSetlist.sundaySchool.songs.map((song, idx) => {
                    const matchedSong = songs.find(
                      (s) => s.id === song.songId || s.title.toLowerCase() === song.title.toLowerCase()
                    );

                    return (
                      <div
                        key={song.id || idx}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <span className="text-sm font-semibold text-slate-900 dark:text-white truncate block">
                              {song.title}
                            </span>
                            {song.keyNote && (
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                                {song.keyNote}
                              </span>
                            )}
                          </div>
                        </div>

                        {matchedSong && (
                          <button
                            onClick={() => onOpenSongDetail(matchedSong.id)}
                            className="text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 flex items-center gap-1 shrink-0 ml-2"
                            title="View lyrics & chords in Song Library"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Lyrics</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {activeSetlist.sundaySchool.notes && (
                <div className="text-xs text-slate-600 dark:text-slate-400 bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
                  <span className="font-semibold block mb-0.5 text-slate-700 dark:text-slate-300">Notes:</span>
                  {activeSetlist.sundaySchool.notes}
                </div>
              )}
            </div>

            {/* Part 2: Worship Service */}
            <div className="p-4 sm:p-5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-slate-700">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Part 2 (10:15 AM)
                  </span>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">Worship Service</h4>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">Song Leader</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {activeSetlist.worshipService.songLeader}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-2">
                  Song Order ({activeSetlist.worshipService.songs.length} songs):
                </span>
                <div className="space-y-2">
                  {activeSetlist.worshipService.songs.map((song, idx) => {
                    const matchedSong = songs.find(
                      (s) => s.id === song.songId || s.title.toLowerCase() === song.title.toLowerCase()
                    );

                    return (
                      <div
                        key={song.id || idx}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <span className="text-sm font-semibold text-slate-900 dark:text-white truncate block">
                              {song.title}
                            </span>
                            {song.keyNote && (
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                                {song.keyNote}
                              </span>
                            )}
                          </div>
                        </div>

                        {matchedSong && (
                          <button
                            onClick={() => onOpenSongDetail(matchedSong.id)}
                            className="text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 flex items-center gap-1 shrink-0 ml-2"
                            title="View lyrics & chords in Song Library"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Lyrics</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {activeSetlist.worshipService.notes && (
                <div className="text-xs text-slate-600 dark:text-slate-400 bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
                  <span className="font-semibold block mb-0.5 text-slate-700 dark:text-slate-300">Notes:</span>
                  {activeSetlist.worshipService.notes}
                </div>
              )}
            </div>
          </div>

          {activeSetlist.generalNotes && (
            <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200">
              <span className="font-bold block mb-1">General Program Notes:</span>
              <p>{activeSetlist.generalNotes}</p>
            </div>
          )}
        </div>
      )}

      {/* Setlist List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            All Scheduled Setlists ({filteredSetlists.length})
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Soonest upcoming dates first
          </span>
        </div>

        {filteredSetlists.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
              No setlists found matching your search.
            </p>
            <button
              onClick={handleStartCreate}
              className="mt-3 text-xs font-semibold text-slate-900 dark:text-white underline"
            >
              Create a new setlist
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredSetlists.map((setlist) => {
              const isPast = isPastDate(setlist.date);
              const today = isToday(setlist.date);
              const isSelected = activeSetlistId === setlist.id;

              return (
                <div
                  key={setlist.id}
                  onClick={() => setActiveSetlistId(isSelected ? null : setlist.id)}
                  className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer hover:border-slate-400 dark:hover:border-slate-600 ${
                    isSelected
                      ? 'border-slate-900 dark:border-slate-100 ring-1 ring-slate-900 dark:ring-slate-100 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 border ${
                          today
                            ? 'bg-amber-500 text-white border-amber-600'
                            : !isPast
                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-800 dark:border-slate-200'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider leading-none">
                          {formatDateStr(setlist.date, { shortMonth: true }).split(' ')[0]}
                        </span>
                        <span className="text-sm font-black leading-none mt-0.5">
                          {setlist.date.split('-')[2]}
                        </span>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            {formatDateStr(setlist.date, { showDayOfWeek: true })}
                          </h4>
                          {today && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                              Today
                            </span>
                          )}
                          {!isPast && !today && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                              Upcoming
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500 dark:text-slate-400">
                          <span>
                            Presider: <strong className="text-slate-700 dark:text-slate-300">{setlist.presider}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            SS: <strong className="text-slate-700 dark:text-slate-300">{setlist.sundaySchool.songLeader}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            WS: <strong className="text-slate-700 dark:text-slate-300">{setlist.worshipService.songLeader}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 text-slate-400">
                      <span className="text-xs hidden sm:inline text-slate-500 dark:text-slate-400">
                        {setlist.sundaySchool.songs.length + setlist.worshipService.songs.length} songs
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isEditing && editingSetlist && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingSetlist.id && setlists.some((s) => s.id === editingSetlist.id)
                  ? 'Edit Sunday Setlist'
                  : 'Create New Sunday Setlist'}
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-5 sm:p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* Date & Presider */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Sunday Service Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={editingSetlist.date || ''}
                    onChange={(e) => setEditingSetlist({ ...editingSetlist, date: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Presider Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingSetlist.presider || ''}
                    onChange={(e) => setEditingSetlist({ ...editingSetlist, presider: e.target.value })}
                    placeholder="e.g. Ptr. Jonathan Santos / Bro. Roberto"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* Sunday School (2-4 songs) */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Part 1: Sunday School (2–4 Songs)
                  </h4>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sunday School Song Leader
                  </label>
                  <input
                    type="text"
                    value={editingSetlist.sundaySchool?.songLeader || ''}
                    onChange={(e) =>
                      setEditingSetlist({
                        ...editingSetlist,
                        sundaySchool: {
                          ...editingSetlist.sundaySchool!,
                          songLeader: e.target.value,
                          songs: editingSetlist.sundaySchool?.songs || [],
                        },
                      })
                    }
                    placeholder="e.g. Bro. Christian Ramos"
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      Songs (2 to 4):
                    </span>
                    {(editingSetlist.sundaySchool?.songs?.length || 0) < 4 && (
                      <button
                        type="button"
                        onClick={() => {
                          const curr = editingSetlist.sundaySchool?.songs || [];
                          setEditingSetlist({
                            ...editingSetlist,
                            sundaySchool: {
                              ...editingSetlist.sundaySchool!,
                              songs: [...curr, { id: `ss-${Date.now()}`, title: '', keyNote: '' }],
                            },
                          });
                        }}
                        className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Song
                      </button>
                    )}
                  </div>

                  {(editingSetlist.sundaySchool?.songs || []).map((s, idx) => (
                    <div key={s.id || idx} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 w-4">{idx + 1}.</span>
                      <input
                        type="text"
                        value={s.title}
                        onChange={(e) => {
                          const updated = [...(editingSetlist.sundaySchool?.songs || [])];
                          updated[idx].title = e.target.value;
                          setEditingSetlist({
                            ...editingSetlist,
                            sundaySchool: { ...editingSetlist.sundaySchool!, songs: updated },
                          });
                        }}
                        placeholder="Song Title (select or type)"
                        className="flex-1 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
                      />
                      <input
                        type="text"
                        value={s.keyNote || ''}
                        onChange={(e) => {
                          const updated = [...(editingSetlist.sundaySchool?.songs || [])];
                          updated[idx].keyNote = e.target.value;
                          setEditingSetlist({
                            ...editingSetlist,
                            sundaySchool: { ...editingSetlist.sundaySchool!, songs: updated },
                          });
                        }}
                        placeholder="Key (e.g. Key of G)"
                        className="w-24 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
                      />
                      {(editingSetlist.sundaySchool?.songs?.length || 0) > 2 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = (editingSetlist.sundaySchool?.songs || []).filter((_, i) => i !== idx);
                            setEditingSetlist({
                              ...editingSetlist,
                              sundaySchool: { ...editingSetlist.sundaySchool!, songs: updated },
                            });
                          }}
                          className="p-1.5 text-rose-500 hover:text-rose-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div>
                  <input
                    type="text"
                    value={editingSetlist.sundaySchool?.notes || ''}
                    onChange={(e) =>
                      setEditingSetlist({
                        ...editingSetlist,
                        sundaySchool: {
                          ...editingSetlist.sundaySchool!,
                          notes: e.target.value,
                          songs: editingSetlist.sundaySchool?.songs || [],
                        },
                      })
                    }
                    placeholder="Optional Sunday School notes..."
                    className="w-full p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              {/* Worship Service (2-4 songs) */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Part 2: Worship Service (2–4 Songs)
                  </h4>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Worship Service Song Leader
                  </label>
                  <input
                    type="text"
                    value={editingSetlist.worshipService?.songLeader || ''}
                    onChange={(e) =>
                      setEditingSetlist({
                        ...editingSetlist,
                        worshipService: {
                          ...editingSetlist.worshipService!,
                          songLeader: e.target.value,
                          songs: editingSetlist.worshipService?.songs || [],
                        },
                      })
                    }
                    placeholder="e.g. Sis. Abigail Cruz"
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      Songs (2 to 4):
                    </span>
                    {(editingSetlist.worshipService?.songs?.length || 0) < 4 && (
                      <button
                        type="button"
                        onClick={() => {
                          const curr = editingSetlist.worshipService?.songs || [];
                          setEditingSetlist({
                            ...editingSetlist,
                            worshipService: {
                              ...editingSetlist.worshipService!,
                              songs: [...curr, { id: `ws-${Date.now()}`, title: '', keyNote: '' }],
                            },
                          });
                        }}
                        className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Song
                      </button>
                    )}
                  </div>

                  {(editingSetlist.worshipService?.songs || []).map((s, idx) => (
                    <div key={s.id || idx} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 w-4">{idx + 1}.</span>
                      <input
                        type="text"
                        value={s.title}
                        onChange={(e) => {
                          const updated = [...(editingSetlist.worshipService?.songs || [])];
                          updated[idx].title = e.target.value;
                          setEditingSetlist({
                            ...editingSetlist,
                            worshipService: { ...editingSetlist.worshipService!, songs: updated },
                          });
                        }}
                        placeholder="Song Title (select or type)"
                        className="flex-1 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
                      />
                      <input
                        type="text"
                        value={s.keyNote || ''}
                        onChange={(e) => {
                          const updated = [...(editingSetlist.worshipService?.songs || [])];
                          updated[idx].keyNote = e.target.value;
                          setEditingSetlist({
                            ...editingSetlist,
                            worshipService: { ...editingSetlist.worshipService!, songs: updated },
                          });
                        }}
                        placeholder="Key (e.g. Key of D)"
                        className="w-24 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
                      />
                      {(editingSetlist.worshipService?.songs?.length || 0) > 2 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = (editingSetlist.worshipService?.songs || []).filter((_, i) => i !== idx);
                            setEditingSetlist({
                              ...editingSetlist,
                              worshipService: { ...editingSetlist.worshipService!, songs: updated },
                            });
                          }}
                          className="p-1.5 text-rose-500 hover:text-rose-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div>
                  <input
                    type="text"
                    value={editingSetlist.worshipService?.notes || ''}
                    onChange={(e) =>
                      setEditingSetlist({
                        ...editingSetlist,
                        worshipService: {
                          ...editingSetlist.worshipService!,
                          notes: e.target.value,
                          songs: editingSetlist.worshipService?.songs || [],
                        },
                      })
                    }
                    placeholder="Optional Worship Service notes..."
                    className="w-full p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>

              {/* General Notes */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  General Program Announcements & Notes
                </label>
                <textarea
                  rows={2}
                  value={editingSetlist.generalNotes || ''}
                  onChange={(e) => setEditingSetlist({ ...editingSetlist, generalNotes: e.target.value })}
                  placeholder="e.g. Fellowship lunch, Communion Sunday, Deacon meeting..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-white shadow-sm"
                >
                  Save Setlist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
