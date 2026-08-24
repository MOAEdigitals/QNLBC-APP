import React, { useState } from 'react';
import { Setlist, Song, SetlistSongItem, SetlistType } from '../types';
import {
  formatDateStr,
  isPastDate,
  isToday,
  getNextSundayStr,
  sortUpcomingFirst,
} from '../utils/dateUtils';
import {
  loadWelcomeSongs,
  saveWelcomeSongs,
  getAllDirectoryNames,
  getThemeSongForMonth,
} from '../utils/storage';
import { AutofillInput } from './AutofillInput';
import {
  Calendar,
  Clock,
  User,
  Music,
  Plus,
  Trash2,
  Edit3,
  X,
  FileText,
  Sparkles,
  ChevronDown,
  Users,
  HeartHandshake,
  Flame,
  Check,
  Bookmark,
} from 'lucide-react';

interface SetlistsTabProps {
  setlists: Setlist[];
  songs: Song[];
  onSaveSetlist: (setlist: Setlist) => void;
  onDeleteSetlist: (id: string) => void;
  onOpenSongDetail: (songId: string) => void;
}

export const SetlistsTab: React.FC<SetlistsTabProps> = ({
  setlists,
  songs,
  onSaveSetlist,
  onDeleteSetlist,
  onOpenSongDetail,
}) => {
  const [selectedSetlistId, setSelectedSetlistId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingSetlist, setEditingSetlist] = useState<Partial<Setlist> | null>(null);
  const [welcomeSongsList, setWelcomeSongsList] = useState<string[]>(() => loadWelcomeSongs());
  const [newWelcomeSongInput, setNewWelcomeSongInput] = useState('');
  const [showAddWelcomeSong, setShowAddWelcomeSong] = useState(false);
  const [showTypeSelector, setShowTypeSelector] = useState(false);

  // Directory names for autocomplete
  const directoryNames = getAllDirectoryNames();
  const songTitleSuggestions = songs.map((s) => s.title);

  // Sort upcoming soonest first, then past below
  const sortedSetlists = sortUpcomingFirst<Setlist>(setlists, (s: Setlist) => s.date);

  // Find soonest upcoming setlist
  const soonestUpcoming = sortedSetlists.find((s) => !isPastDate(s.date));

  const selectedSetlist = setlists.find((s) => s.id === selectedSetlistId);

  // Handle adding a new custom welcome song
  const handleAddNewWelcomeSong = () => {
    if (!newWelcomeSongInput.trim()) return;
    const clean = newWelcomeSongInput.trim();
    if (!welcomeSongsList.includes(clean)) {
      const updated = [...welcomeSongsList, clean];
      saveWelcomeSongs(updated);
      setWelcomeSongsList(updated);
    }
    if (editingSetlist) {
      setEditingSetlist({ ...editingSetlist, welcomeSong: clean });
    }
    setNewWelcomeSongInput('');
    setShowAddWelcomeSong(false);
  };

  // Start creating Sunday Setlist
  const handleStartCreateSunday = () => {
    const nextSun = getNextSundayStr();
    // Auto-populate theme song for that month if exists in first Sunday
    const monthTheme = getThemeSongForMonth(setlists, nextSun);

    setEditingSetlist({
      id: `setlist-${Date.now()}`,
      type: 'sunday',
      date: nextSun,
      presider: '',
      welcomeSong: 'Napakaligaya',
      closingSong: 'Give Thanks',
      themeSong: monthTheme || '',
      sundaySchool: {
        songLeader: '',
        songs: [
          { id: `ss-1`, title: '', notes: '' },
          { id: `ss-2`, title: '', notes: '' },
        ],
        notes: 'Sunday School starts at 8:30 AM',
      },
      worshipService: {
        songLeader: '',
        songs: [
          { id: `ws-1`, title: '', notes: '' },
          { id: `ws-2`, title: '', notes: '' },
          { id: `ws-3`, title: '', notes: '' },
        ],
        notes: 'Worship Service begins promptly at 9:30 AM',
      },
      generalNotes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setIsEditing(true);
    setShowTypeSelector(false);
  };

  // Start creating non-Sunday setlist (Prayer Meeting, Fellowship, Event)
  const handleStartCreateOther = (type: SetlistType) => {
    const nextSun = getNextSundayStr();

    if (type === 'prayer_meeting') {
      setEditingSetlist({
        id: `setlist-${Date.now()}`,
        type: 'prayer_meeting',
        title: 'Midweek Prayer Meeting',
        date: nextSun,
        program: {
          songLeader: '',
          songs: [
            { id: `pm-1`, title: '', notes: '' },
            { id: `pm-2`, title: '', notes: '' },
          ],
          notes: 'Opening prayer & devotional study',
        },
        generalNotes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } else if (type === 'fellowship') {
      setEditingSetlist({
        id: `setlist-${Date.now()}`,
        type: 'fellowship',
        title: 'Youth Fellowship',
        date: nextSun,
        presider: '',
        welcomeSong: 'Napakaligaya',
        closingSong: '',
        program: {
          songLeader: '',
          songs: [
            { id: `fel-1`, title: '', notes: '' },
            { id: `fel-2`, title: '', notes: '' },
          ],
          notes: '',
        },
        generalNotes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } else if (type === 'event') {
      setEditingSetlist({
        id: `setlist-${Date.now()}`,
        type: 'event',
        title: '',
        date: nextSun,
        presider: '',
        welcomeSong: 'Napakaligaya',
        closingSong: 'Give Thanks',
        program: {
          songLeader: '',
          songs: [
            { id: `ev-1`, title: '', notes: '' },
            { id: `ev-2`, title: '', notes: '' },
            { id: `ev-3`, title: '', notes: '' },
          ],
          notes: '',
        },
        generalNotes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    setIsEditing(true);
    setShowTypeSelector(false);
  };

  const handleStartEdit = (setlist: Setlist) => {
    setEditingSetlist(JSON.parse(JSON.stringify(setlist)));
    setIsEditing(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSetlist || !editingSetlist.date) return;

    const setlistType: SetlistType = editingSetlist.type || 'sunday';

    const cleanSongs = (songsList: SetlistSongItem[] | undefined): SetlistSongItem[] => {
      if (!songsList) return [];
      return songsList
        .filter((s) => s.title.trim().length > 0)
        .map((s) => {
          const matchedSong = songs.find(
            (item) => item.title.trim().toLowerCase() === s.title.trim().toLowerCase()
          );
          return {
            ...s,
            title: s.title.trim(),
            songId: matchedSong ? matchedSong.id : s.songId,
            notes: s.notes?.trim() || undefined,
            keyNote: s.keyNote?.trim() || undefined,
          };
        });
    };

    const finalSetlist: Setlist = {
      id: editingSetlist.id || `setlist-${Date.now()}`,
      type: setlistType,
      title: editingSetlist.title?.trim() || undefined,
      date: editingSetlist.date,
      presider: editingSetlist.presider?.trim() || undefined,
      welcomeSong: editingSetlist.welcomeSong?.trim() || undefined,
      closingSong: editingSetlist.closingSong?.trim() || undefined,
      themeSong: editingSetlist.themeSong?.trim() || undefined,
      sundaySchool:
        setlistType === 'sunday'
          ? {
              songLeader: editingSetlist.sundaySchool?.songLeader?.trim() || '',
              songs: cleanSongs(editingSetlist.sundaySchool?.songs),
              notes: editingSetlist.sundaySchool?.notes?.trim() || undefined,
            }
          : undefined,
      worshipService:
        setlistType === 'sunday'
          ? {
              songLeader: editingSetlist.worshipService?.songLeader?.trim() || '',
              songs: cleanSongs(editingSetlist.worshipService?.songs),
              notes: editingSetlist.worshipService?.notes?.trim() || undefined,
            }
          : undefined,
      program:
        setlistType !== 'sunday'
          ? {
              songLeader: editingSetlist.program?.songLeader?.trim() || '',
              songs: cleanSongs(editingSetlist.program?.songs),
              notes: editingSetlist.program?.notes?.trim() || undefined,
            }
          : undefined,
      generalNotes: editingSetlist.generalNotes?.trim() || undefined,
      createdAt: editingSetlist.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveSetlist(finalSetlist);
    setIsEditing(false);
    setSelectedSetlistId(finalSetlist.id);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Creation Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-800 dark:text-slate-200" />
            <span>Church Service Programs & Setlists</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Sunday School (8:30 AM), Worship Service (9:30 AM), Midweek, Fellowships, and Events
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 relative">
          <button
            onClick={handleStartCreateSunday}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold hover:bg-slate-800 dark:hover:bg-white transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Sunday Setlist</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowTypeSelector(!showTypeSelector)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
            >
              <span>+ Fellowship / Event / Prayer</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {showTypeSelector && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl z-30 py-2 divide-y divide-slate-100 dark:divide-slate-800">
                <button
                  type="button"
                  onClick={() => handleStartCreateOther('prayer_meeting')}
                  className="w-full px-4 py-2.5 text-left text-xs sm:text-sm text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
                >
                  <Flame className="w-4 h-4 text-amber-500" />
                  <div>
                    <span className="font-semibold block">Midweek Prayer Meeting</span>
                    <span className="text-[11px] text-slate-400">1 straight program, 1-2 songs</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleStartCreateOther('fellowship')}
                  className="w-full px-4 py-2.5 text-left text-xs sm:text-sm text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
                >
                  <Users className="w-4 h-4 text-indigo-500" />
                  <div>
                    <span className="font-semibold block">Fellowship Gathering</span>
                    <span className="text-[11px] text-slate-400">Youth, Men, Women, 2-3 songs</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleStartCreateOther('event')}
                  className="w-full px-4 py-2.5 text-left text-xs sm:text-sm text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-emerald-500" />
                  <div>
                    <span className="font-semibold block">Special Event / Conference</span>
                    <span className="text-[11px] text-slate-400">Anniversary, 3-4 songs, full program</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selected Setlist Detail Display */}
      {selectedSetlist && !isEditing && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 p-5 sm:p-6 shadow-md space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {selectedSetlist.type === 'prayer_meeting'
                    ? 'Prayer Meeting Program'
                    : selectedSetlist.type === 'fellowship'
                    ? 'Fellowship Program'
                    : selectedSetlist.type === 'event'
                    ? 'Special Event Program'
                    : 'Sunday Service Order'}
                </span>

                {isToday(selectedSetlist.date) ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white">
                    Today
                  </span>
                ) : !isPastDate(selectedSetlist.date) ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                    Upcoming Date
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    Past Service
                  </span>
                )}
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {selectedSetlist.title || formatDateStr(selectedSetlist.date, { showDayOfWeek: true })}
              </h3>

              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {selectedSetlist.type === 'sunday' || !selectedSetlist.type
                    ? 'Sunday School: 8:30 AM • Worship Service: 9:30 AM'
                    : `Scheduled for ${formatDateStr(selectedSetlist.date, { showDayOfWeek: true })}`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleStartEdit(selectedSetlist)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit</span>
              </button>

              <button
                onClick={() => {
                  if (confirm(`Remove this setlist for ${selectedSetlist.date}?`)) {
                    onDeleteSetlist(selectedSetlist.id);
                    setSelectedSetlistId(null);
                  }
                }}
                className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-medium transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sunday Service Layout */}
          {(!selectedSetlist.type || selectedSetlist.type === 'sunday') && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Presider & Service Header Card */}
              <div className="md:col-span-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Presider (Worship Service)
                    </span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {selectedSetlist.presider || 'Not assigned yet'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs">
                  {selectedSetlist.welcomeSong && (
                    <div className="bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 font-medium mr-1.5">Welcome Song:</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {selectedSetlist.welcomeSong}
                      </span>
                    </div>
                  )}
                  {selectedSetlist.closingSong && (
                    <div className="bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 font-medium mr-1.5">Closing Song:</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {selectedSetlist.closingSong}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Sunday School (8:30 AM) */}
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div>
                    <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                      Part 1 • 8:30 AM
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Sunday School
                    </h4>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    Leader: {selectedSetlist.sundaySchool?.songLeader || 'Unassigned'}
                  </span>
                </div>

                <div className="space-y-2">
                  {(selectedSetlist.sundaySchool?.songs || []).map((song, idx) => (
                    <div
                      key={song.id || idx}
                      className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                          {idx + 1}. {song.title}
                        </span>
                        {song.notes && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                            {song.notes}
                          </span>
                        )}
                      </div>
                      {song.songId && (
                        <button
                          onClick={() => onOpenSongDetail(song.songId!)}
                          className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 underline shrink-0 ml-2"
                        >
                          Lyrics
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {selectedSetlist.sundaySchool?.notes && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic pt-1">
                    Note: {selectedSetlist.sundaySchool.notes}
                  </p>
                )}
              </div>

              {/* Worship Service (9:30 AM) */}
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div>
                    <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                      Part 2 • 9:30 AM
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Worship Service
                    </h4>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    Leader: {selectedSetlist.worshipService?.songLeader || 'Unassigned'}
                  </span>
                </div>

                <div className="space-y-2">
                  {(selectedSetlist.worshipService?.songs || []).map((song, idx) => (
                    <div
                      key={song.id || idx}
                      className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                          {idx + 1}. {song.title}
                        </span>
                        {song.notes && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                            {song.notes}
                          </span>
                        )}
                      </div>
                      {song.songId && (
                        <button
                          onClick={() => onOpenSongDetail(song.songId!)}
                          className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 underline shrink-0 ml-2"
                        >
                          Lyrics
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Month Theme Song displayed in line-up */}
                  {selectedSetlist.themeSong && (
                    <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-center justify-between">
                      <div className="min-w-0 pr-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 block">
                          ★ Month Theme Song (Congregational)
                        </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                          {selectedSetlist.themeSong}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {selectedSetlist.worshipService?.notes && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 italic pt-1">
                    Note: {selectedSetlist.worshipService.notes}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Non-Sunday Programs (Prayer Meeting, Fellowship, Event) */}
          {selectedSetlist.type && selectedSetlist.type !== 'sunday' && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-3">
                <div className="flex items-center space-x-3">
                  {selectedSetlist.presider && (
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                        Presider
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {selectedSetlist.presider}
                      </span>
                    </div>
                  )}
                  {selectedSetlist.program?.songLeader && (
                    <div className="pl-3 border-l border-slate-200 dark:border-slate-700">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                        Song Leader
                      </span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {selectedSetlist.program.songLeader}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {selectedSetlist.welcomeSong && (
                    <div className="bg-white dark:bg-slate-900 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 font-medium mr-1.5">Welcome Song:</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {selectedSetlist.welcomeSong}
                      </span>
                    </div>
                  )}
                  {selectedSetlist.closingSong && (
                    <div className="bg-white dark:bg-slate-900 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 font-medium mr-1.5">Closing Song:</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {selectedSetlist.closingSong}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Program Songs */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Program Songs:
                </span>
                {(selectedSetlist.program?.songs || []).map((song, idx) => (
                  <div
                    key={song.id || idx}
                    className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                        {idx + 1}. {song.title}
                      </span>
                      {song.notes && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                          {song.notes}
                        </span>
                      )}
                    </div>
                    {song.songId && (
                      <button
                        onClick={() => onOpenSongDetail(song.songId!)}
                        className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 underline shrink-0 ml-2"
                      >
                        Lyrics
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {selectedSetlist.program?.notes && (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                  Notes: {selectedSetlist.program.notes}
                </p>
              )}
            </div>
          )}

          {/* General Notes */}
          {selectedSetlist.generalNotes && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Announcements & Program Notes:
              </span>
              <p className="text-slate-600 dark:text-slate-400">{selectedSetlist.generalNotes}</p>
            </div>
          )}
        </div>
      )}

      {/* Setlists Listing */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            All Church Programs & Setlists ({sortedSetlists.length})
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Soonest upcoming date highlighted at top
          </span>
        </div>

        {sortedSetlists.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
            No setlists created yet. Click "+ Sunday Setlist" or "+ Fellowship / Event / Prayer" to start.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {sortedSetlists.map((item) => {
              const isPast = isPastDate(item.date);
              const today = isToday(item.date);
              const isSelected = selectedSetlistId === item.id;
              const isSoonest = soonestUpcoming?.id === item.id;

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedSetlistId(isSelected ? null : item.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-slate-900 dark:border-slate-100 ring-2 ring-slate-900 dark:ring-slate-100 bg-white dark:bg-slate-900 shadow-md'
                      : isSoonest
                      ? 'border-amber-400 dark:border-amber-600 ring-2 ring-amber-500/80 bg-amber-50/20 dark:bg-amber-950/20'
                      : isPast
                      ? 'bg-slate-100/60 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60 opacity-65 text-slate-500'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3.5 min-w-0">
                      {/* Date Badge */}
                      <div
                        className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 border ${
                          today
                            ? 'bg-amber-500 text-white border-amber-600'
                            : isSoonest
                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-800 dark:border-slate-200'
                            : isPast
                            ? 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500 border-slate-300 dark:border-slate-700'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider leading-none">
                          {formatDateStr(item.date, { shortMonth: true }).split(' ')[0]}
                        </span>
                        <span className="text-base font-black leading-none mt-0.5">
                          {item.date.split('-')[2]}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4
                            className={`text-sm font-bold truncate ${
                              isPast ? 'text-slate-600 dark:text-slate-400' : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {item.title || formatDateStr(item.date, { showDayOfWeek: true })}
                          </h4>

                          {isSoonest && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                              ★ Soonest Upcoming
                            </span>
                          )}

                          {!isPast && !isSoonest && !today && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                              Upcoming
                            </span>
                          )}

                          {today && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white">
                              Today
                            </span>
                          )}

                          {isPast && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 dark:bg-slate-800 text-slate-500">
                              Past
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {item.presider && (
                            <span>Presider: {item.presider}</span>
                          )}
                          {item.type === 'sunday' || !item.type ? (
                            <>
                              <span>•</span>
                              <span>SS (8:30 AM): {item.sundaySchool?.songLeader || 'TBD'}</span>
                              <span>•</span>
                              <span>WS (9:30 AM): {item.worshipService?.songLeader || 'TBD'}</span>
                            </>
                          ) : (
                            <>
                              <span>•</span>
                              <span>Leader: {item.program?.songLeader || 'TBD'}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 text-slate-400 shrink-0 ml-2">
                      <span className="text-xs font-semibold hidden sm:inline text-slate-500">
                        {isSelected ? 'Close' : 'View Program'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Form Modal */}
      {isEditing && editingSetlist && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-4">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                <span>
                  {editingSetlist.type === 'prayer_meeting'
                    ? 'Edit Prayer Meeting Program'
                    : editingSetlist.type === 'fellowship'
                    ? 'Edit Fellowship Program'
                    : editingSetlist.type === 'event'
                    ? 'Edit Special Event Program'
                    : 'Edit Sunday Setlist Program'}
                </span>
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 sm:p-5 space-y-4 max-h-[82vh] overflow-y-auto">
              {/* Date & Title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Scheduled Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={editingSetlist.date || ''}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      const newMonthTheme = getThemeSongForMonth(setlists, newDate);
                      setEditingSetlist({
                        ...editingSetlist,
                        date: newDate,
                        themeSong: editingSetlist.themeSong || newMonthTheme,
                      });
                    }}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    {editingSetlist.type === 'event'
                      ? 'Event Title (e.g. Youth Conference) *'
                      : editingSetlist.type === 'fellowship'
                      ? 'Fellowship Group Name *'
                      : 'Setlist Title (Optional)'}
                  </label>
                  <input
                    type="text"
                    required={editingSetlist.type === 'event' || editingSetlist.type === 'fellowship'}
                    value={editingSetlist.title || ''}
                    onChange={(e) => setEditingSetlist({ ...editingSetlist, title: e.target.value })}
                    placeholder={
                      editingSetlist.type === 'event'
                        ? 'e.g. 15th Church Anniversary & Thanksgiving'
                        : editingSetlist.type === 'fellowship'
                        ? "e.g. Men's Fellowship / Youth Fellowship"
                        : 'e.g. Regular Sunday Worship'
                    }
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
                  />
                </div>
              </div>

              {/* Presider (if applicable) */}
              {editingSetlist.type !== 'prayer_meeting' && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Presider (Autofill with Enter)
                  </label>
                  <div className="p-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
                    <AutofillInput
                      value={editingSetlist.presider || ''}
                      onChange={(val) => setEditingSetlist({ ...editingSetlist, presider: val })}
                      suggestions={directoryNames}
                      placeholder="e.g. Ptr. Jonathan Santos / Bro. Christian Ramos"
                      inputClassName="p-1.5 text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {/* Welcome Song & Closing Song & Theme Song (for Sunday or Fellowships/Events) */}
              {editingSetlist.type !== 'prayer_meeting' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  {/* Welcome Song */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Welcome Song
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowAddWelcomeSong(!showAddWelcomeSong)}
                        className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline"
                      >
                        + Custom Welcome Song
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <select
                        value={editingSetlist.welcomeSong || 'Napakaligaya'}
                        onChange={(e) => setEditingSetlist({ ...editingSetlist, welcomeSong: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white"
                      >
                        {welcomeSongsList.map((ws) => (
                          <option key={ws} value={ws}>
                            {ws} {ws === 'Napakaligaya' ? '(Default)' : ''}
                          </option>
                        ))}
                      </select>

                      {showAddWelcomeSong && (
                        <div className="flex items-center gap-1.5 pt-1">
                          <input
                            type="text"
                            value={newWelcomeSongInput}
                            onChange={(e) => setNewWelcomeSongInput(e.target.value)}
                            placeholder="Type new welcome song title..."
                            className="flex-1 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={handleAddNewWelcomeSong}
                            className="px-2.5 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold"
                          >
                            Save
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Closing Song */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                      Closing Song
                    </label>
                    <input
                      type="text"
                      value={editingSetlist.closingSong || ''}
                      onChange={(e) => setEditingSetlist({ ...editingSetlist, closingSong: e.target.value })}
                      placeholder="Default: Give Thanks"
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Month Theme Song (Sunday Setlist) */}
                  {(!editingSetlist.type || editingSetlist.type === 'sunday') && (
                    <div className="sm:col-span-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Month Theme Song (Auto-propagates across this month)</span>
                        </label>
                      </div>
                      <div className="p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700">
                        <AutofillInput
                          value={editingSetlist.themeSong || ''}
                          onChange={(val) => setEditingSetlist({ ...editingSetlist, themeSong: val })}
                          suggestions={songTitleSuggestions}
                          placeholder="e.g. Dakilang Katapatan (Choir & congregation theme song)"
                          inputClassName="p-1.5 text-xs sm:text-sm text-slate-900 dark:text-white"
                        />
                      </div>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-1">
                        The theme song entered for the first Sunday automatically populates other setlists in the same month.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Sunday School & Worship Service Forms (Sunday Setlist) */}
              {(!editingSetlist.type || editingSetlist.type === 'sunday') && (
                <>
                  {/* Sunday School (8:30 AM, 2-3 songs) */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                          8:30 AM
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Part 1: Sunday School (2–3 Songs)
                        </h4>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Sunday School Song Leader (Autofill with Enter)
                      </label>
                      <div className="p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700">
                        <AutofillInput
                          value={editingSetlist.sundaySchool?.songLeader || ''}
                          onChange={(val) =>
                            setEditingSetlist({
                              ...editingSetlist,
                              sundaySchool: {
                                ...editingSetlist.sundaySchool!,
                                songLeader: val,
                                songs: editingSetlist.sundaySchool?.songs || [],
                              },
                            })
                          }
                          suggestions={directoryNames}
                          placeholder="e.g. Bro. Christian Ramos"
                          inputClassName="p-1.5 text-xs sm:text-sm text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          Songs (2 to 3):
                        </span>
                        {(editingSetlist.sundaySchool?.songs?.length || 0) < 3 && (
                          <button
                            type="button"
                            onClick={() => {
                              const curr = editingSetlist.sundaySchool?.songs || [];
                              setEditingSetlist({
                                ...editingSetlist,
                                sundaySchool: {
                                  ...editingSetlist.sundaySchool!,
                                  songs: [...curr, { id: `ss-${Date.now()}`, title: '', notes: '' }],
                                },
                              });
                            }}
                            className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Song
                          </button>
                        )}
                      </div>

                      {(editingSetlist.sundaySchool?.songs || []).map((s, idx) => (
                        <div key={s.id || idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <span className="text-xs font-bold text-slate-400 w-4 self-center sm:self-auto">{idx + 1}.</span>
                          <div className="flex-1 p-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700">
                            <AutofillInput
                              value={s.title}
                              onChange={(val) => {
                                const updated = [...(editingSetlist.sundaySchool?.songs || [])];
                                updated[idx].title = val;
                                setEditingSetlist({
                                  ...editingSetlist,
                                  sundaySchool: { ...editingSetlist.sundaySchool!, songs: updated },
                                });
                              }}
                              suggestions={songTitleSuggestions}
                              placeholder="Song Title (type or select from library)"
                              inputClassName="p-1.5 text-xs text-slate-900 dark:text-white"
                            />
                          </div>

                          <input
                            type="text"
                            value={s.notes || ''}
                            onChange={(e) => {
                              const updated = [...(editingSetlist.sundaySchool?.songs || [])];
                              updated[idx].notes = e.target.value;
                              setEditingSetlist({
                                ...editingSetlist,
                                sundaySchool: { ...editingSetlist.sundaySchool!, songs: updated },
                              });
                            }}
                            placeholder="Notes (e.g. 3 stanzas, Acoustic)"
                            className="sm:w-36 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
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
                              className="p-1.5 text-rose-500 hover:text-rose-700 self-center"
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

                  {/* Worship Service (9:30 AM, 2-4 songs) */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                          9:30 AM
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          Part 2: Worship Service (2–4 Songs)
                        </h4>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Worship Service Song Leader (Autofill with Enter)
                      </label>
                      <div className="p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700">
                        <AutofillInput
                          value={editingSetlist.worshipService?.songLeader || ''}
                          onChange={(val) =>
                            setEditingSetlist({
                              ...editingSetlist,
                              worshipService: {
                                ...editingSetlist.worshipService!,
                                songLeader: val,
                                songs: editingSetlist.worshipService?.songs || [],
                              },
                            })
                          }
                          suggestions={directoryNames}
                          placeholder="e.g. Sis. Abigail Cruz"
                          inputClassName="p-1.5 text-xs sm:text-sm text-slate-900 dark:text-white"
                        />
                      </div>
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
                                  songs: [...curr, { id: `ws-${Date.now()}`, title: '', notes: '' }],
                                },
                              });
                            }}
                            className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Song
                          </button>
                        )}
                      </div>

                      {(editingSetlist.worshipService?.songs || []).map((s, idx) => (
                        <div key={s.id || idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <span className="text-xs font-bold text-slate-400 w-4 self-center sm:self-auto">{idx + 1}.</span>
                          <div className="flex-1 p-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700">
                            <AutofillInput
                              value={s.title}
                              onChange={(val) => {
                                const updated = [...(editingSetlist.worshipService?.songs || [])];
                                updated[idx].title = val;
                                setEditingSetlist({
                                  ...editingSetlist,
                                  worshipService: { ...editingSetlist.worshipService!, songs: updated },
                                });
                              }}
                              suggestions={songTitleSuggestions}
                              placeholder="Song Title (type or select from library)"
                              inputClassName="p-1.5 text-xs text-slate-900 dark:text-white"
                            />
                          </div>

                          <input
                            type="text"
                            value={s.notes || ''}
                            onChange={(e) => {
                              const updated = [...(editingSetlist.worshipService?.songs || [])];
                              updated[idx].notes = e.target.value;
                              setEditingSetlist({
                                ...editingSetlist,
                                worshipService: { ...editingSetlist.worshipService!, songs: updated },
                              });
                            }}
                            placeholder="Notes (e.g. Key of D, 2 stanzas)"
                            className="sm:w-36 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
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
                              className="p-1.5 text-rose-500 hover:text-rose-700 self-center"
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
                </>
              )}

              {/* Non-Sunday Program Editor (Prayer Meeting, Fellowship, Event) */}
              {editingSetlist.type && editingSetlist.type !== 'sunday' && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Program Lineup & Songs (
                    {editingSetlist.type === 'prayer_meeting'
                      ? '1–2 Songs'
                      : editingSetlist.type === 'fellowship'
                      ? '2–3 Songs'
                      : '3–4 Songs'}
                    )
                  </h4>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Song Leader (Autofill with Enter)
                    </label>
                    <div className="p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700">
                      <AutofillInput
                        value={editingSetlist.program?.songLeader || ''}
                        onChange={(val) =>
                          setEditingSetlist({
                            ...editingSetlist,
                            program: {
                              ...editingSetlist.program!,
                              songLeader: val,
                              songs: editingSetlist.program?.songs || [],
                            },
                          })
                        }
                        suggestions={directoryNames}
                        placeholder="e.g. Bro. Mark Villanueva"
                        inputClassName="p-1.5 text-xs sm:text-sm text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        Songs:
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const curr = editingSetlist.program?.songs || [];
                          setEditingSetlist({
                            ...editingSetlist,
                            program: {
                              ...editingSetlist.program!,
                              songs: [...curr, { id: `prog-${Date.now()}`, title: '', notes: '' }],
                            },
                          });
                        }}
                        className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Song
                      </button>
                    </div>

                    {(editingSetlist.program?.songs || []).map((s, idx) => (
                      <div key={s.id || idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 w-4 self-center sm:self-auto">{idx + 1}.</span>
                        <div className="flex-1 p-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700">
                          <AutofillInput
                            value={s.title}
                            onChange={(val) => {
                              const updated = [...(editingSetlist.program?.songs || [])];
                              updated[idx].title = val;
                              setEditingSetlist({
                                ...editingSetlist,
                                program: { ...editingSetlist.program!, songs: updated },
                              });
                            }}
                            suggestions={songTitleSuggestions}
                            placeholder="Song Title (type or select from library)"
                            inputClassName="p-1.5 text-xs text-slate-900 dark:text-white"
                          />
                        </div>

                        <input
                          type="text"
                          value={s.notes || ''}
                          onChange={(e) => {
                            const updated = [...(editingSetlist.program?.songs || [])];
                            updated[idx].notes = e.target.value;
                            setEditingSetlist({
                              ...editingSetlist,
                              program: { ...editingSetlist.program!, songs: updated },
                            });
                          }}
                          placeholder="Notes / instructions"
                          className="sm:w-36 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
                        />

                        {(editingSetlist.program?.songs?.length || 0) > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = (editingSetlist.program?.songs || []).filter((_, i) => i !== idx);
                              setEditingSetlist({
                                ...editingSetlist,
                                program: { ...editingSetlist.program!, songs: updated },
                              });
                            }}
                            className="p-1.5 text-rose-500 hover:text-rose-700 self-center"
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
                      value={editingSetlist.program?.notes || ''}
                      onChange={(e) =>
                        setEditingSetlist({
                          ...editingSetlist,
                          program: {
                            ...editingSetlist.program!,
                            notes: e.target.value,
                            songs: editingSetlist.program?.songs || [],
                          },
                        })
                      }
                      placeholder="Optional program notes..."
                      className="w-full p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>
              )}

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

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-white shadow-sm cursor-pointer"
                >
                  Save Setlist Program
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
