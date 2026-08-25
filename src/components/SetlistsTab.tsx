import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Plus,
  Trash2,
  Edit3,
  X,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Users,
  Flame,
  AlertCircle,
  CheckCircle,
  MoreVertical,
} from 'lucide-react';

interface SetlistsTabProps {
  setlists: Setlist[];
  songs: Song[];
  onSaveSetlist: (setlist: Setlist) => void;
  onDeleteSetlist: (id: string) => void;
  onOpenSongDetail: (songId: string, returnSetlistId?: string) => void;
  onSubViewChange?: (hasActiveSubView: boolean) => void;
  initialSelectedSetlistId?: string | null;
  collapseSignal?: number;
}

export const SetlistsTab: React.FC<SetlistsTabProps> = ({
  setlists,
  songs,
  onSaveSetlist,
  onDeleteSetlist,
  onOpenSongDetail,
  onSubViewChange,
  initialSelectedSetlistId,
  collapseSignal,
}) => {
  const [selectedSetlistId, setSelectedSetlistId] = useState<string | null>(initialSelectedSetlistId || null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingSetlist, setEditingSetlist] = useState<Partial<Setlist> | null>(null);
  const [showCustomTitle, setShowCustomTitle] = useState(false);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [openMenuSetlistId, setOpenMenuSetlistId] = useState<string | null>(null);

  // Sync initialSelectedSetlistId prop if provided
  useEffect(() => {
    if (initialSelectedSetlistId) {
      setSelectedSetlistId(initialSelectedSetlistId);
    }
  }, [initialSelectedSetlistId]);

  // Collapse active expanded setlist / editor if home tab icon is tapped
  useEffect(() => {
    if (collapseSignal !== undefined && collapseSignal > 0) {
      setSelectedSetlistId(null);
      setIsEditing(false);
      setEditingSetlist(null);
      setEditPromptMsg(null);
      setShowTypeSelector(false);
    }
  }, [collapseSignal]);

  // Back swipe & dirty state tracking
  const initialEditingJsonRef = useRef<string>('');
  const backSwipeCountRef = useRef(0);
  const backSwipeTimeoutRef = useRef<any>(null);
  const [editPromptMsg, setEditPromptMsg] = useState<{ type: 'info' | 'warn'; message: string } | null>(null);

  // Memoized directory names for autocomplete (only recompute when editing modal opens or songs change)
  const directoryNames = useMemo(() => getAllDirectoryNames(), [isEditing]);
  const songTitleSuggestions = useMemo(() => songs.map((s) => s.title), [songs]);

  // Marked songs from library (plus defaults)
  const markedWelcomeSongs = useMemo(
    () =>
      Array.from(
        new Set(['Napakaligaya', ...songs.filter((s) => s.isWelcomeSong).map((s) => s.title)])
      ).filter(Boolean),
    [songs]
  );

  const markedClosingSongs = useMemo(
    () =>
      Array.from(
        new Set(['Give Thanks', ...songs.filter((s) => s.isClosingSong).map((s) => s.title)])
      ).filter(Boolean),
    [songs]
  );

  // Sort upcoming soonest first, then past below
  const sortedSetlists = useMemo(
    () => sortUpcomingFirst<Setlist>(setlists, (s: Setlist) => s.date),
    [setlists]
  );
  const soonestUpcoming = useMemo(
    () => sortedSetlists.find((s) => !isPastDate(s.date)),
    [sortedSetlists]
  );
  const selectedSetlist = useMemo(
    () => setlists.find((s) => s.id === selectedSetlistId),
    [setlists, selectedSetlistId]
  );

  // Close popovers on outside click
  useEffect(() => {
    const handleDocumentClick = () => {
      setOpenMenuSetlistId(null);
      setShowTypeSelector(false);
    };
    if (openMenuSetlistId || showTypeSelector) {
      document.addEventListener('click', handleDocumentClick);
    }
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [openMenuSetlistId, showTypeSelector]);

  // Notify parent App whether there is an active subview (expanded setlist or editor modal)
  useEffect(() => {
    const hasActive = !!selectedSetlistId || isEditing;
    if (onSubViewChange) {
      onSubViewChange(hasActive);
    }
  }, [selectedSetlistId, isEditing, onSubViewChange]);

  // History state & Back navigation / swipe listener
  useEffect(() => {
    const handlePopState = () => {
      // 1. If editor modal is open
      if (isEditing && editingSetlist) {
        const isDirty = JSON.stringify(editingSetlist) !== initialEditingJsonRef.current;

        // If no changes made, close immediately
        if (!isDirty) {
          setIsEditing(false);
          setEditingSetlist(null);
          setEditPromptMsg(null);
          backSwipeCountRef.current = 0;
          return;
        }

        // If user swiped/pressed back twice, exit creation/editing
        if (backSwipeCountRef.current >= 1) {
          setIsEditing(false);
          setEditingSetlist(null);
          setEditPromptMsg(null);
          backSwipeCountRef.current = 0;
          return;
        }

        // First swipe/back: check completeness and prompt
        backSwipeCountRef.current = 1;
        const isEventOrFellowship = editingSetlist.type === 'event' || editingSetlist.type === 'fellowship';
        const hasMissingFields = !editingSetlist.date || (isEventOrFellowship && !editingSetlist.title?.trim());

        if (hasMissingFields) {
          setEditPromptMsg({
            type: 'warn',
            message: 'Incomplete required fields. Please fill all fields, or swipe back again to exit.',
          });
        } else {
          setEditPromptMsg({
            type: 'info',
            message: 'All fields completed. Please click Save, or swipe back again to exit.',
          });
        }

        // Push state back to prevent unintended page exit
        window.history.pushState({ tab: 'home', subView: 'editing' }, '', '#home');

        if (backSwipeTimeoutRef.current) clearTimeout(backSwipeTimeoutRef.current);
        backSwipeTimeoutRef.current = setTimeout(() => {
          backSwipeCountRef.current = 0;
          setEditPromptMsg(null);
        }, 3500);
        return;
      }

      // 2. If a setlist is expanded, collapse it
      if (selectedSetlistId) {
        setSelectedSetlistId(null);
        return;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isEditing, editingSetlist, selectedSetlistId]);

  // Start creating Sunday Setlist
  const handleStartCreateSunday = () => {
    const nextSun = getNextSundayStr();
    const monthTheme = getThemeSongForMonth(setlists, nextSun);

    const initialData: Partial<Setlist> = {
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
          { id: `ss-1`, title: '' },
          { id: `ss-2`, title: '' },
        ],
        notes: '',
      },
      worshipService: {
        songLeader: '',
        songs: [
          { id: `ws-1`, title: '' },
          { id: `ws-2`, title: '' },
        ],
        notes: '',
      },
      generalNotes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    initialEditingJsonRef.current = JSON.stringify(initialData);
    setEditingSetlist(initialData);
    setShowCustomTitle(false);
    setIsEditing(true);
    setEditPromptMsg(null);
    backSwipeCountRef.current = 0;
    setShowTypeSelector(false);
    window.history.pushState({ tab: 'home', subView: 'editing' }, '', '#home');
  };

  // Start creating non-Sunday setlist (Prayer Meeting, Fellowship, Event)
  const handleStartCreateOther = (type: SetlistType) => {
    const nextSun = getNextSundayStr();
    let initialData: Partial<Setlist>;

    if (type === 'prayer_meeting') {
      initialData = {
        id: `setlist-${Date.now()}`,
        type: 'prayer_meeting',
        title: 'Midweek Prayer Meeting',
        date: nextSun,
        program: {
          songLeader: '',
          songs: [
            { id: `pm-1`, title: '' },
            { id: `pm-2`, title: '' },
          ],
          notes: '',
        },
        generalNotes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } else if (type === 'fellowship') {
      initialData = {
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
            { id: `fel-1`, title: '' },
            { id: `fel-2`, title: '' },
          ],
          notes: '',
        },
        generalNotes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } else {
      initialData = {
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
            { id: `ev-1`, title: '' },
            { id: `ev-2`, title: '' },
            { id: `ev-3`, title: '' },
          ],
          notes: '',
        },
        generalNotes: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    initialEditingJsonRef.current = JSON.stringify(initialData);
    setEditingSetlist(initialData);
    setIsEditing(true);
    setEditPromptMsg(null);
    backSwipeCountRef.current = 0;
    setShowTypeSelector(false);
    window.history.pushState({ tab: 'home', subView: 'editing' }, '', '#home');
  };

  const handleStartEdit = (setlist: Setlist) => {
    const cloned = JSON.parse(JSON.stringify(setlist));
    initialEditingJsonRef.current = JSON.stringify(cloned);
    setEditingSetlist(cloned);
    setShowCustomTitle(!!cloned.title);
    setIsEditing(true);
    setEditPromptMsg(null);
    backSwipeCountRef.current = 0;
    window.history.pushState({ tab: 'home', subView: 'editing' }, '', '#home');
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
            id: s.id || `song-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            title: s.title.trim(),
            songId: matchedSong ? matchedSong.id : s.songId,
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
    setEditingSetlist(null);
    setEditPromptMsg(null);
    setSelectedSetlistId(finalSetlist.id);
  };

  const handleSelectSetlist = (id: string) => {
    if (selectedSetlistId === id) {
      setSelectedSetlistId(null);
    } else {
      setSelectedSetlistId(id);
      window.history.pushState({ tab: 'home', subView: 'detail', id }, '', '#home');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-800 dark:text-slate-200" />
            <span>Church Service Programs & Setlists</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Sunday School, Worship Service, Midweek, Fellowships, and Events
          </p>
        </div>

        {/* Buttons: Event Setlist on left, Sunday Setlist on right */}
        <div className="flex flex-wrap items-center gap-2 relative">
          {/* Event Setlist dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowTypeSelector(!showTypeSelector)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
            >
              <Plus className="w-4 h-4" />
              <span>Event Setlist</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {showTypeSelector && (
              <div className="absolute left-0 sm:right-0 sm:left-auto top-full mt-2 w-60 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl z-30 py-1.5 divide-y divide-slate-100 dark:divide-slate-800">
                <button
                  type="button"
                  onClick={() => handleStartCreateOther('prayer_meeting')}
                  className="w-full px-4 py-2.5 text-left text-xs sm:text-sm text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
                >
                  <Flame className="w-4 h-4 text-sky-500 shrink-0" />
                  <span className="font-semibold">Midweek Prayer Meeting</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleStartCreateOther('fellowship')}
                  className="w-full px-4 py-2.5 text-left text-xs sm:text-sm text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
                >
                  <Users className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="font-semibold">Fellowship Gathering</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleStartCreateOther('event')}
                  className="w-full px-4 py-2.5 text-left text-xs sm:text-sm text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="font-semibold">Special Event</span>
                </button>
              </div>
            )}
          </div>

          {/* Sunday Setlist button on the right */}
          <button
            onClick={handleStartCreateSunday}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold hover:bg-slate-800 dark:hover:bg-white transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Sunday Setlist</span>
          </button>
        </div>
      </div>

      {/* Setlists Listing with In-Place Accordion Expansion */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            All Setlists ({sortedSetlists.length})
          </span>
        </div>

        {sortedSetlists.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
            No setlists created yet. Click "Sunday Setlist" or "Event Setlist" to start.
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
                  onClick={() => handleSelectSetlist(item.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-slate-900 dark:border-slate-100 ring-2 ring-slate-900 dark:ring-slate-100 bg-white dark:bg-slate-900 shadow-md'
                      : isSoonest
                      ? 'border-slate-400 dark:border-slate-500 ring-2 ring-slate-400/40 bg-slate-50/70 dark:bg-slate-800/40'
                      : isPast
                      ? 'bg-slate-100/60 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60 opacity-65 text-slate-500'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-400'
                  }`}
                >
                  {/* Card Header Row with Far-Right 3-Dots / Actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3.5 min-w-0">
                      {/* Date Badge */}
                      <div
                        className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 border ${
                          today
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900'
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
                            className={`text-base font-black truncate ${
                              isPast ? 'text-slate-600 dark:text-slate-400' : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {item.title || formatDateStr(item.date, { showDayOfWeek: true })}
                          </h4>

                          {isSoonest && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                              ★ Soonest Upcoming
                            </span>
                          )}

                          {!isPast && !isSoonest && !today && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                              Upcoming
                            </span>
                          )}

                          {today && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900">
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
                          {item.presider && <span>Presider: {item.presider}</span>}
                          {item.type === 'sunday' || !item.type ? (
                            <>
                              <span>•</span>
                              <span>SS: {item.sundaySchool?.songLeader || 'TBD'}</span>
                              <span>•</span>
                              <span>WS: {item.worshipService?.songLeader || 'TBD'}</span>
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

                    {/* Far Right 3-dots Menu & Chevron */}
                    <div
                      className="flex items-center space-x-1.5 text-slate-400 shrink-0 ml-2 relative"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenMenuSetlistId(openMenuSetlistId === item.id ? null : item.id)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                        title="Program Options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {openMenuSetlistId === item.id && (
                        <div className="absolute right-0 top-full mt-1.5 w-48 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1.5 z-40 space-y-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuSetlistId(null);
                              handleStartEdit(item);
                            }}
                            className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                            <span>Edit Program</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuSetlistId(null);
                              if (confirm(`Remove this setlist for ${item.date}?`)) {
                                onDeleteSetlist(item.id);
                                if (selectedSetlistId === item.id) setSelectedSetlistId(null);
                              }
                            }}
                            className="w-full px-3.5 py-2 text-left text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete Setlist</span>
                          </button>
                        </div>
                      )}

                      <div className="p-1 text-slate-400">
                        {isSelected ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* IN-PLACE EXPANDED ACCORDION CONTENT */}
                  {isSelected && (
                    <div
                      className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4 cursor-default"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Sunday Service Layout */}
                      {(!item.type || item.type === 'sunday') && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Presider & Service Header Badges */}
                          <div className="md:col-span-2 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center space-x-3">
                              <div className="p-2 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700">
                                <User className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                                  Presider
                                </span>
                                <span className="text-sm font-bold text-slate-900 dark:text-white">
                                  {item.presider || 'Not assigned yet'}
                                </span>
                              </div>
                            </div>

                            {/* Badges: Welcome Song & Closing Song (With linkage to Song Library!) */}
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              {item.welcomeSong && (() => {
                                const matchedSong = songs.find(
                                  (s) => s.title.trim().toLowerCase() === item.welcomeSong?.trim().toLowerCase()
                                );
                                return (
                                  <div className="bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                                    <span className="text-slate-400 font-medium">Welcome Song:</span>
                                    <span
                                      onClick={() => (matchedSong ? onOpenSongDetail(matchedSong.id, item.id) : null)}
                                      className={`font-bold text-slate-900 dark:text-white ${
                                        matchedSong
                                          ? 'cursor-pointer hover:underline hover:text-sky-600 dark:hover:text-sky-400'
                                          : ''
                                      }`}
                                      title={matchedSong ? 'Click to open in Song Library' : undefined}
                                    >
                                      {item.welcomeSong}
                                    </span>
                                    {matchedSong && <ExternalLink className="w-3 h-3 text-slate-400" />}
                                  </div>
                                );
                              })()}

                              {item.closingSong && (() => {
                                const matchedSong = songs.find(
                                  (s) => s.title.trim().toLowerCase() === item.closingSong?.trim().toLowerCase()
                                );
                                return (
                                  <div className="bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                                    <span className="text-slate-400 font-medium">Closing Song:</span>
                                    <span
                                      onClick={() => (matchedSong ? onOpenSongDetail(matchedSong.id, item.id) : null)}
                                      className={`font-bold text-slate-900 dark:text-white ${
                                        matchedSong
                                          ? 'cursor-pointer hover:underline hover:text-sky-600 dark:hover:text-sky-400'
                                          : ''
                                      }`}
                                      title={matchedSong ? 'Click to open in Song Library' : undefined}
                                    >
                                      {item.closingSong}
                                    </span>
                                    {matchedSong && <ExternalLink className="w-3 h-3 text-slate-400" />}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Sunday School */}
                          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
                              <div>
                                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                                  Part 1
                                </span>
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                  Sunday School
                                </h4>
                              </div>
                              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                Leader: {item.sundaySchool?.songLeader || 'Unassigned'}
                              </span>
                            </div>

                            <div className="space-y-2">
                              {(item.sundaySchool?.songs || []).map((song, idx) => {
                                const matchedSong = song.songId
                                  ? songs.find((s) => s.id === song.songId)
                                  : songs.find((s) => s.title.trim().toLowerCase() === song.title.trim().toLowerCase());
                                const targetSongId = matchedSong ? matchedSong.id : song.songId;

                                return (
                                  <div
                                    key={song.id || idx}
                                    className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                                  >
                                    <span
                                      onClick={() => (targetSongId ? onOpenSongDetail(targetSongId, item.id) : null)}
                                      className={`text-xs font-bold text-slate-900 dark:text-white truncate ${
                                        targetSongId
                                          ? 'cursor-pointer hover:underline hover:text-sky-600 dark:hover:text-sky-400 transition-colors'
                                          : ''
                                      }`}
                                      title={targetSongId ? 'Click to open in Song Library' : undefined}
                                    >
                                      {idx + 1}. {song.title}
                                    </span>
                                    {song.keyNote && (
                                      <span className="text-[10px] text-slate-400 font-medium shrink-0 ml-2">
                                        {song.keyNote}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {item.sundaySchool?.notes && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 italic pt-1">
                                Note: {item.sundaySchool.notes}
                              </p>
                            )}
                          </div>

                          {/* Worship Service */}
                          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
                              <div>
                                <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                                  Part 2
                                </span>
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                  Worship Service
                                </h4>
                              </div>
                              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                Leader: {item.worshipService?.songLeader || 'Unassigned'}
                              </span>
                            </div>

                            <div className="space-y-2">
                              {(item.worshipService?.songs || []).map((song, idx) => {
                                const matchedSong = song.songId
                                  ? songs.find((s) => s.id === song.songId)
                                  : songs.find((s) => s.title.trim().toLowerCase() === song.title.trim().toLowerCase());
                                const targetSongId = matchedSong ? matchedSong.id : song.songId;

                                return (
                                  <div
                                    key={song.id || idx}
                                    className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                                  >
                                    <span
                                      onClick={() => (targetSongId ? onOpenSongDetail(targetSongId, item.id) : null)}
                                      className={`text-xs font-bold text-slate-900 dark:text-white truncate ${
                                        targetSongId
                                          ? 'cursor-pointer hover:underline hover:text-sky-600 dark:hover:text-sky-400 transition-colors'
                                          : ''
                                      }`}
                                      title={targetSongId ? 'Click to open in Song Library' : undefined}
                                    >
                                      {idx + 1}. {song.title}
                                    </span>
                                    {song.keyNote && (
                                      <span className="text-[10px] text-slate-400 font-medium shrink-0 ml-2">
                                        {song.keyNote}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}

                              {/* Month Theme Song in Worship Service */}
                              {item.themeSong && (() => {
                                const matchedSong = songs.find(
                                  (s) => s.title.trim().toLowerCase() === item.themeSong?.trim().toLowerCase()
                                );
                                const songNumber = (item.worshipService?.songs?.length || 0) + 1;
                                const monthAbbr = item.date
                                  ? new Date(item.date).toLocaleString('en-US', { month: 'short' })
                                  : 'Month';

                                return (
                                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                    <div className="min-w-0 pr-2">
                                      <span
                                        onClick={() => (matchedSong ? onOpenSongDetail(matchedSong.id, item.id) : null)}
                                        className={`text-xs font-bold text-slate-900 dark:text-white ${
                                          matchedSong
                                            ? 'cursor-pointer hover:underline hover:text-sky-600 dark:hover:text-sky-400 transition-colors'
                                            : ''
                                        }`}
                                        title={matchedSong ? 'Click to open in Song Library' : undefined}
                                      >
                                        {songNumber}. {item.themeSong} ({monthAbbr} - Theme song)
                                      </span>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>

                            {item.worshipService?.notes && (
                              <p className="text-xs text-slate-500 dark:text-slate-400 italic pt-1">
                                Note: {item.worshipService.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Non-Sunday Programs (Prayer Meeting, Fellowship, Event) */}
                      {item.type && item.type !== 'sunday' && (
                        <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-3">
                            <div className="flex items-center space-x-3">
                              {item.presider && (
                                <div>
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                                    Presider
                                  </span>
                                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                                    {item.presider}
                                  </span>
                                </div>
                              )}
                              {item.program?.songLeader && (
                                <div className="pl-3 border-l border-slate-200 dark:border-slate-700">
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                                    Song Leader
                                  </span>
                                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                                    {item.program.songLeader}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              {item.welcomeSong && (() => {
                                const matchedSong = songs.find(
                                  (s) => s.title.trim().toLowerCase() === item.welcomeSong?.trim().toLowerCase()
                                );
                                return (
                                  <div className="bg-white dark:bg-slate-900 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                                    <span className="text-slate-400 font-medium">Welcome Song:</span>
                                    <span
                                      onClick={() => (matchedSong ? onOpenSongDetail(matchedSong.id, item.id) : null)}
                                      className={`font-bold text-slate-900 dark:text-white ${
                                        matchedSong
                                          ? 'cursor-pointer hover:underline hover:text-sky-600 dark:hover:text-sky-400'
                                          : ''
                                      }`}
                                      title={matchedSong ? 'Click to open in Song Library' : undefined}
                                    >
                                      {item.welcomeSong}
                                    </span>
                                    {matchedSong && <ExternalLink className="w-3 h-3 text-slate-400" />}
                                  </div>
                                );
                              })()}

                              {item.closingSong && (() => {
                                const matchedSong = songs.find(
                                  (s) => s.title.trim().toLowerCase() === item.closingSong?.trim().toLowerCase()
                                );
                                return (
                                  <div className="bg-white dark:bg-slate-900 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                                    <span className="text-slate-400 font-medium">Closing Song:</span>
                                    <span
                                      onClick={() => (matchedSong ? onOpenSongDetail(matchedSong.id, item.id) : null)}
                                      className={`font-bold text-slate-900 dark:text-white ${
                                        matchedSong
                                          ? 'cursor-pointer hover:underline hover:text-sky-600 dark:hover:text-sky-400'
                                          : ''
                                      }`}
                                      title={matchedSong ? 'Click to open in Song Library' : undefined}
                                    >
                                      {item.closingSong}
                                    </span>
                                    {matchedSong && <ExternalLink className="w-3 h-3 text-slate-400" />}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Program Songs */}
                          <div className="space-y-2">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                              Program Songs:
                            </span>
                            {(item.program?.songs || []).map((song, idx) => {
                              const matchedSong = song.songId
                                ? songs.find((s) => s.id === song.songId)
                                : songs.find((s) => s.title.trim().toLowerCase() === song.title.trim().toLowerCase());
                              const targetSongId = matchedSong ? matchedSong.id : song.songId;

                              return (
                                <div
                                  key={song.id || idx}
                                  className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                                >
                                  <span
                                    onClick={() => (targetSongId ? onOpenSongDetail(targetSongId, item.id) : null)}
                                    className={`text-xs font-bold text-slate-900 dark:text-white truncate ${
                                      targetSongId
                                        ? 'cursor-pointer hover:underline hover:text-sky-600 dark:hover:text-sky-400 transition-colors'
                                        : ''
                                    }`}
                                    title={targetSongId ? 'Click to open in Song Library' : undefined}
                                  >
                                    {idx + 1}. {song.title}
                                  </span>
                                  {song.keyNote && (
                                    <span className="text-[10px] text-slate-400 font-medium shrink-0 ml-2">
                                      {song.keyNote}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {item.program?.notes && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 italic pt-1">
                              Note: {item.program.notes}
                            </p>
                          )}
                        </div>
                      )}

                      {/* General Notes */}
                      {item.generalNotes && (
                        <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
                          <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                            Announcements & Program Notes:
                          </span>
                          <p className="text-slate-600 dark:text-slate-400">{item.generalNotes}</p>
                        </div>
                      )}
                    </div>
                  )}
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
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditingSetlist(null);
                  setEditPromptMsg(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Back swipe warning toast/banner */}
            {editPromptMsg && (
              <div
                className={`mx-4 sm:mx-5 mt-4 p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
                  editPromptMsg.type === 'warn'
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300'
                    : 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900 text-indigo-800 dark:text-indigo-300'
                }`}
              >
                {editPromptMsg.type === 'warn' ? (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                ) : (
                  <CheckCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{editPromptMsg.message}</span>
              </div>
            )}

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

                {editingSetlist.type === 'event' || editingSetlist.type === 'fellowship' || editingSetlist.type === 'prayer_meeting' ? (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                      {editingSetlist.type === 'event'
                        ? 'Event Title *'
                        : editingSetlist.type === 'fellowship'
                        ? 'Fellowship Group Name *'
                        : 'Prayer Meeting Title'}
                    </label>
                    <input
                      type="text"
                      required={editingSetlist.type === 'event' || editingSetlist.type === 'fellowship'}
                      value={editingSetlist.title || ''}
                      onChange={(e) => setEditingSetlist({ ...editingSetlist, title: e.target.value })}
                      placeholder={
                        editingSetlist.type === 'event'
                          ? 'e.g. 15th Church Anniversary'
                          : editingSetlist.type === 'fellowship'
                          ? "e.g. Youth Fellowship"
                          : 'e.g. Midweek Prayer Meeting'
                      }
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col justify-end">
                    {!showCustomTitle && !editingSetlist.title ? (
                      <div className="py-2.5">
                        <button
                          type="button"
                          onClick={() => setShowCustomTitle(true)}
                          className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Custom Setlist Title</span>
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            SETLIST TITLE
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setShowCustomTitle(false);
                              setEditingSetlist({ ...editingSetlist, title: undefined });
                            }}
                            className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline cursor-pointer"
                          >
                            Remove custom title
                          </button>
                        </div>
                        <input
                          type="text"
                          value={editingSetlist.title || ''}
                          onChange={(e) => setEditingSetlist({ ...editingSetlist, title: e.target.value })}
                          placeholder="e.g. Easter Sunday Service"
                          className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Presider */}
              {editingSetlist.type !== 'prayer_meeting' && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Presider
                  </label>
                  <div className="p-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
                    <AutofillInput
                      value={editingSetlist.presider || ''}
                      onChange={(val) => setEditingSetlist({ ...editingSetlist, presider: val })}
                      suggestions={directoryNames}
                      placeholder="e.g. Ptr. Jonathan Santos"
                      inputClassName="p-1.5 text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {/* Welcome Song & Closing Song & Month Theme Song */}
              {editingSetlist.type !== 'prayer_meeting' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  {/* Welcome Song Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Welcome Song
                      </label>
                    </div>

                    <div className="p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-xs">
                      <AutofillInput
                        value={editingSetlist.welcomeSong ?? 'Napakaligaya'}
                        onChange={(val) => setEditingSetlist({ ...editingSetlist, welcomeSong: val })}
                        suggestions={markedWelcomeSongs}
                        allSuggestions={songTitleSuggestions}
                        defaultValue="Napakaligaya"
                        songs={songs}
                        setlists={setlists}
                        placeholder="Type or select welcome song..."
                        inputClassName="p-1.5 text-xs sm:text-sm text-slate-900 dark:text-white font-medium"
                      />
                    </div>
                  </div>

                  {/* Closing Song Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Closing Song
                      </label>
                    </div>

                    <div className="p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-xs">
                      <AutofillInput
                        value={editingSetlist.closingSong ?? 'Give Thanks'}
                        onChange={(val) => setEditingSetlist({ ...editingSetlist, closingSong: val })}
                        suggestions={markedClosingSongs}
                        allSuggestions={songTitleSuggestions}
                        defaultValue="Give Thanks"
                        songs={songs}
                        setlists={setlists}
                        placeholder="Type or select closing song..."
                        inputClassName="p-1.5 text-xs sm:text-sm text-slate-900 dark:text-white font-medium"
                      />
                    </div>
                  </div>

                  {/* Month Theme Song (Sunday Setlist) */}
                  {(!editingSetlist.type || editingSetlist.type === 'sunday') && (
                    <div className="sm:col-span-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                          <span>Month Theme Song</span>
                        </label>
                      </div>
                      <div className="p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700">
                        <AutofillInput
                          value={editingSetlist.themeSong || ''}
                          onChange={(val) => setEditingSetlist({ ...editingSetlist, themeSong: val })}
                          suggestions={songTitleSuggestions}
                          songs={songs}
                          setlists={setlists}
                          placeholder="e.g. Dakilang Katapatan"
                          inputClassName="p-1.5 text-xs sm:text-sm text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sunday School & Worship Service Forms (Sunday Setlist) */}
              {(!editingSetlist.type || editingSetlist.type === 'sunday') && (
                <>
                  {/* Sunday School Section */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3.5">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Part 1: Sunday School
                    </h4>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Sunday School Song Leader
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

                    {/* Compact Stacked Song Fields with Numbers Right Before */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          Songs:
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
                                  songs: [...curr, { id: `ss-${Date.now()}`, title: '' }],
                                },
                              });
                            }}
                            className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Song</span>
                          </button>
                        )}
                      </div>

                      {(editingSetlist.sundaySchool?.songs || []).map((s, idx) => (
                        <div key={s.id || idx} className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 w-5 shrink-0 text-right">
                            {idx + 1}.
                          </span>
                          <div className="flex-1 p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700">
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
                              songs={songs}
                              setlists={setlists}
                              placeholder="Song Title"
                              inputClassName="p-1.5 text-xs sm:text-sm text-slate-900 dark:text-white"
                            />
                          </div>

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
                              className="p-2 text-rose-500 hover:text-rose-700 shrink-0 cursor-pointer"
                              title="Delete song"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Worship Service Section */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3.5">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      Part 2: Worship Service
                    </h4>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Worship Service Song Leader
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

                    {/* Compact Stacked Song Fields with Numbers Right Before */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                          Songs:
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
                                  songs: [...curr, { id: `ws-${Date.now()}`, title: '' }],
                                },
                              });
                            }}
                            className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Song</span>
                          </button>
                        )}
                      </div>

                      {(editingSetlist.worshipService?.songs || []).map((s, idx) => (
                        <div key={s.id || idx} className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 w-5 shrink-0 text-right">
                            {idx + 1}.
                          </span>
                          <div className="flex-1 p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700">
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
                              songs={songs}
                              setlists={setlists}
                              placeholder="Song Title"
                              inputClassName="p-1.5 text-xs sm:text-sm text-slate-900 dark:text-white"
                            />
                          </div>

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
                              className="p-2 text-rose-500 hover:text-rose-700 shrink-0 cursor-pointer"
                              title="Delete song"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Non-Sunday Program Editor (Prayer Meeting, Fellowship, Event) */}
              {editingSetlist.type && editingSetlist.type !== 'sunday' && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3.5">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Program Songs
                  </h4>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Song Leader
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

                  {/* Compact Stacked Song Fields with Numbers Right Before */}
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
                              songs: [...curr, { id: `prog-${Date.now()}`, title: '' }],
                            },
                          });
                        }}
                        className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Song</span>
                      </button>
                    </div>

                    {(editingSetlist.program?.songs || []).map((s, idx) => (
                      <div key={s.id || idx} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 w-5 shrink-0 text-right">
                          {idx + 1}.
                        </span>
                        <div className="flex-1 p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700">
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
                            songs={songs}
                            setlists={setlists}
                            placeholder="Song Title"
                            inputClassName="p-1.5 text-xs sm:text-sm text-slate-900 dark:text-white"
                          />
                        </div>

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
                            className="p-2 text-rose-500 hover:text-rose-700 shrink-0 cursor-pointer"
                            title="Delete song"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
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
                  onClick={() => {
                    setIsEditing(false);
                    setEditingSetlist(null);
                    setEditPromptMsg(null);
                  }}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-white shadow-xs cursor-pointer"
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
