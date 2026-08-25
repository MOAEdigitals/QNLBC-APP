import React, { useState } from 'react';
import { SpecialNumberEntry, Song, Setlist } from '../types';
import {
  formatDateStr,
  isPastDate,
  isToday,
  getNextSundayStr,
  sortUpcomingFirst,
} from '../utils/dateUtils';
import {
  getAllDirectoryNames,
  formatDuplicateTitle,
  upsertSongFromSpecialNumber,
} from '../utils/storage';
import { AutofillInput } from './AutofillInput';
import {
  Mic2,
  Plus,
  Music,
  ExternalLink,
  Calendar,
  Sparkles,
  Trash2,
  Edit3,
  X,
  Play,
  FileText,
  Check,
  Search,
  AlertTriangle,
  Info,
} from 'lucide-react';

interface SpecialNumberTabProps {
  specialNumbers: SpecialNumberEntry[];
  songs: Song[];
  setlists: Setlist[];
  onSaveSpecialNumber: (entry: SpecialNumberEntry) => void;
  onDeleteSpecialNumber: (id: string) => void;
  onOpenSongDetail: (songId: string) => void;
  collapseSignal?: number;
}

export const SpecialNumberTab: React.FC<SpecialNumberTabProps> = ({
  specialNumbers,
  songs,
  setlists,
  onSaveSpecialNumber,
  onDeleteSpecialNumber,
  onOpenSongDetail,
  collapseSignal,
}) => {
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Partial<SpecialNumberEntry> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [syncedNotice, setSyncedNotice] = useState(false);

  // Collapse active container if tab icon is tapped
  React.useEffect(() => {
    if (collapseSignal !== undefined && collapseSignal > 0) {
      setSelectedEntryId(null);
      setIsEditing(false);
      setEditingEntry(null);
    }
  }, [collapseSignal]);

  // Back swipe / popstate listener to collapse container
  React.useEffect(() => {
    const handlePopState = () => {
      if (isEditing) {
        setIsEditing(false);
        setEditingEntry(null);
        return;
      }
      if (selectedEntryId) {
        setSelectedEntryId(null);
        return;
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isEditing, selectedEntryId]);

  const directoryNames = getAllDirectoryNames();
  const songTitleSuggestions = songs.map((s) => s.title);

  // Sorted: soonest upcoming at top (nearest future/today first), past dates below
  const sortedEntries = sortUpcomingFirst<SpecialNumberEntry>(
    specialNumbers,
    (e: SpecialNumberEntry) => e.scheduledDate
  );

  const filteredEntries = sortedEntries.filter((item: SpecialNumberEntry) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.performerName.toLowerCase().includes(q) ||
      (item.songTitle && item.songTitle.toLowerCase().includes(q)) ||
      (item.notes && item.notes.toLowerCase().includes(q))
    );
  });

  const selectedEntry = specialNumbers.find((e) => e.id === selectedEntryId);
  const soonestEntry = sortedEntries.find((e) => !isPastDate(e.scheduledDate));

  // Compute Vacancies: Calculate upcoming 4 Sundays and check for missing special numbers
  const calculateVacancies = () => {
    const vacantSundays: string[] = [];
    const baseSunday = new Date(getNextSundayStr());

    for (let i = 0; i < 4; i++) {
      const targetDate = new Date(baseSunday);
      targetDate.setDate(targetDate.getDate() + i * 7);
      const dateStr = targetDate.toISOString().split('T')[0];

      const hasSpecial = specialNumbers.some((s) => s.scheduledDate === dateStr);
      if (!hasSpecial) {
        vacantSundays.push(dateStr);
      }
    }
    return vacantSundays;
  };

  const vacantSundays = calculateVacancies();

  // Check for upcoming Fellowships/Events without a special song number assigned
  const vacantEvents = setlists.filter(
    (s) =>
      s.type &&
      s.type !== 'sunday' &&
      !isPastDate(s.date) &&
      !specialNumbers.some((sp) => sp.scheduledDate === s.date)
  );

  const handleStartCreate = () => {
    setEditingEntry({
      id: `sp-${Date.now()}`,
      performerName: '',
      scheduledDate: vacantSundays.length > 0 ? vacantSundays[0] : getNextSundayStr(),
      songTitle: '',
      minusOneLink: '',
      notes: '',
      lyrics: '',
      createdAt: new Date().toISOString(),
    });
    setIsEditing(true);
  };

  const handleStartEdit = (item: SpecialNumberEntry) => {
    setEditingEntry({ ...item });
    setIsEditing(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry || !editingEntry.performerName?.trim() || !editingEntry.scheduledDate) {
      return;
    }

    let finalSongTitle = editingEntry.songTitle?.trim() || undefined;
    let matchedSongId = editingEntry.songId;

    if (finalSongTitle) {
      const cleanTitle = formatDuplicateTitle(finalSongTitle, songs, editingEntry.songId);
      finalSongTitle = cleanTitle;

      // Upsert song to shared library if lyrics or minus one are provided
      if (editingEntry.lyrics || editingEntry.minusOneLink) {
        const savedSong = upsertSongFromSpecialNumber(
          finalSongTitle,
          editingEntry.lyrics || '',
          editingEntry.minusOneLink
        );
        matchedSongId = savedSong.id;
      }
    }

    const finalEntry: SpecialNumberEntry = {
      id: editingEntry.id || `sp-${Date.now()}`,
      performerName: editingEntry.performerName.trim(),
      scheduledDate: editingEntry.scheduledDate,
      songTitle: finalSongTitle,
      songId: matchedSongId,
      minusOneLink: editingEntry.minusOneLink?.trim() || undefined,
      notes: editingEntry.notes?.trim() || undefined,
      lyrics: editingEntry.lyrics || '',
      createdAt: editingEntry.createdAt || new Date().toISOString(),
    };

    onSaveSpecialNumber(finalEntry);
    setIsEditing(false);
    setSelectedEntryId(finalEntry.id);
    if (finalEntry.songTitle) {
      setSyncedNotice(true);
      setTimeout(() => setSyncedNotice(false), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Mic2 className="w-5 h-5 text-slate-800 dark:text-slate-200" />
            <span>Special Song Numbers</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Dedicated roster for solos, duets, family ensembles, and choir presentations
          </p>
        </div>

        <button
          onClick={handleStartCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold hover:bg-slate-800 dark:hover:bg-white transition-all shadow-xs shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule Special Song Number</span>
        </button>
      </div>

      {/* Vacancy Alerts */}
      {vacantSundays.length > 0 && (
        <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <span className="font-bold text-indigo-950 dark:text-indigo-200 text-sm block">
              Special Song Number Vacancy Alert ({vacantSundays.length} upcoming Sunday{vacantSundays.length > 1 ? 's' : ''} open)
            </span>
            <p className="text-indigo-800 dark:text-indigo-300">
              No special song number is currently assigned for:
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {vacantSundays.map((dateStr) => (
                <button
                  key={dateStr}
                  onClick={() => {
                    setEditingEntry({
                      id: `sp-${Date.now()}`,
                      performerName: '',
                      scheduledDate: dateStr,
                      songTitle: '',
                      minusOneLink: '',
                      notes: '',
                      lyrics: '',
                      createdAt: new Date().toISOString(),
                    });
                    setIsEditing(true);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-900 dark:text-indigo-200 font-semibold hover:bg-indigo-200 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Calendar className="w-3 h-3" />
                  <span>{formatDateStr(dateStr, { showDayOfWeek: true })}</span>
                  <span className="underline ml-1">Assign Now</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Vacant Fellowship / Event Alerts */}
      {vacantEvents.length > 0 && (
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-slate-800 dark:text-slate-200">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-sky-600 shrink-0" />
            <span>
              Upcoming Fellowship/Event:{' '}
              <strong>{vacantEvents[0].title || 'Special Gathering'}</strong> on{' '}
              {formatDateStr(vacantEvents[0].date)} has no special number assigned yet.
            </span>
          </div>
          <button
            onClick={() => {
              setEditingEntry({
                id: `sp-${Date.now()}`,
                performerName: '',
                scheduledDate: vacantEvents[0].date,
                songTitle: '',
                notes: `Special number for ${vacantEvents[0].title || 'Fellowship'}`,
                createdAt: new Date().toISOString(),
              });
              setIsEditing(true);
            }}
            className="px-2.5 py-1 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-semibold hover:bg-slate-800 shrink-0 ml-2 cursor-pointer"
          >
            Assign
          </button>
        </div>
      )}

      {syncedNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>Saved special song number! Song library details synced automatically.</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search performer, song title, or notes..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-colors"
        />
      </div>

      {/* Selected Entry Detail View */}
      {selectedEntry && !isEditing && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 p-5 sm:p-6 shadow-md space-y-5">
          <div
            onClick={() => setSelectedEntryId(null)}
            className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4 cursor-pointer group"
            title="Click header to collapse"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Special Song Number Details
                </span>
                {isToday(selectedEntry.scheduledDate) ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                    Today
                  </span>
                ) : !isPastDate(selectedEntry.scheduledDate) ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                    Upcoming
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    Past
                  </span>
                )}
              </div>

              {/* Performer Name in Large Font per user instruction */}
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1.5 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">
                {selectedEntry.performerName}
              </h3>

              {/* Song Title in smaller font or 'No Song Yet' badge */}
              <div className="mt-1 flex items-center gap-2">
                {selectedEntry.songTitle ? (
                  <span className="text-sm sm:text-base font-semibold text-slate-700 dark:text-slate-300">
                    Song: <span className="italic">{selectedEntry.songTitle}</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    No song decided yet (TBD)
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Scheduled for {formatDateStr(selectedEntry.scheduledDate, { showDayOfWeek: true })}
              </p>
            </div>

            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => handleStartEdit(selectedEntry)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
                <span className="hidden sm:inline">Edit</span>
              </button>
              <button
                onClick={() => {
                  if (confirm(`Remove special song number for ${selectedEntry.performerName}?`)) {
                    onDeleteSpecialNumber(selectedEntry.id);
                    setSelectedEntryId(null);
                  }
                }}
                className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-medium cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSelectedEntryId(null)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-xs transition-colors cursor-pointer"
                title="Collapse Special Number"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Minus-One Link */}
          {selectedEntry.minusOneLink && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center space-x-2.5 min-w-0">
                <Play className="w-4 h-4 text-sky-600 shrink-0" />
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                    Minus-One / Rehearsal Audio Track
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 truncate block">
                    {selectedEntry.minusOneLink}
                  </span>
                </div>
              </div>
              <a
                href={selectedEntry.minusOneLink}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shrink-0 ml-3 flex items-center gap-1 hover:opacity-90"
              >
                <span>Play Track</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {/* Notes */}
          {selectedEntry.notes && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Rehearsal & Presentation Notes:
              </span>
              <p className="text-slate-600 dark:text-slate-400">{selectedEntry.notes}</p>
            </div>
          )}

          {/* Lyrics View */}
          {selectedEntry.lyrics && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  Lyrics & Performance Sheet
                </span>
                {selectedEntry.songId && (
                  <button
                    onClick={() => onOpenSongDetail(selectedEntry.songId!)}
                    className="text-xs text-slate-700 dark:text-slate-300 underline font-semibold cursor-pointer"
                  >
                    Open in Shared Library
                  </button>
                )}
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 font-mono text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                {selectedEntry.lyrics}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Schedule Roster */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Special Song Numbers Schedule ({filteredEntries.length})
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Soonest upcoming scheduled singer at top
          </span>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
            No special song numbers scheduled. Click "Schedule Special Song Number" to add one!
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredEntries.map((item) => {
              const isPast = isPastDate(item.scheduledDate);
              const today = isToday(item.scheduledDate);
              const isSelected = selectedEntryId === item.id;
              const isSoonest = soonestEntry?.id === item.id;

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedEntryId(isSelected ? null : item.id)}
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
                          {formatDateStr(item.scheduledDate, { shortMonth: true }).split(' ')[0]}
                        </span>
                        <span className="text-base font-black leading-none mt-0.5">
                          {item.scheduledDate.split('-')[2]}
                        </span>
                      </div>

                      <div className="min-w-0">
                        {/* Large performer font */}
                        <div className="flex flex-wrap items-center gap-2">
                          <h4
                            className={`text-base font-black truncate ${
                              isPast ? 'text-slate-600 dark:text-slate-400' : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {item.performerName}
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

                        {/* Song title or 'No Song Yet' */}
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5 flex items-center gap-1.5">
                          {item.songTitle ? (
                            <span className="italic font-medium">Song: {item.songTitle}</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              No song yet (TBD)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          <span>{formatDateStr(item.scheduledDate, { showDayOfWeek: true })}</span>
                          {item.minusOneLink && (
                            <>
                              <span>•</span>
                              <span className="text-sky-600 dark:text-sky-400 flex items-center gap-1 font-medium">
                                <Play className="w-3 h-3" /> Track Ready
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 text-slate-400 shrink-0 ml-2">
                      <span className="text-xs font-semibold hidden sm:inline text-slate-500">
                        {isSelected ? 'Close' : 'View Details'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Schedule / Edit Modal */}
      {isEditing && editingEntry && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-4">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Mic2 className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                <span>
                  {specialNumbers.some((s) => s.id === editingEntry.id)
                    ? 'Edit Special Song Number'
                    : 'Schedule New Special Song Number'}
                </span>
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-4 sm:p-5 space-y-4 max-h-[82vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Performer / Group Name *
                  </label>
                  <div className="p-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
                    <AutofillInput
                      value={editingEntry.performerName || ''}
                      onChange={(val) => setEditingEntry({ ...editingEntry, performerName: val })}
                      suggestions={directoryNames}
                      placeholder="e.g. NLBC Youth Choir / Sis. Abigail"
                      inputClassName="p-1.5 text-sm text-slate-900 dark:text-white"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Scheduled Sunday Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={editingEntry.scheduledDate || ''}
                    onChange={(e) => setEditingEntry({ ...editingEntry, scheduledDate: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Song Title with Autofill (Optional per user instruction) */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Song Title (Optional — can be decided later)
                </label>
                <div className="p-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
                  <AutofillInput
                    value={editingEntry.songTitle || ''}
                    onChange={(val) => {
                      const matched = songs.find(
                        (s) => s.title.trim().toLowerCase() === val.trim().toLowerCase()
                      );
                      setEditingEntry({
                        ...editingEntry,
                        songTitle: val,
                        songId: matched ? matched.id : editingEntry.songId,
                        lyrics: matched?.lyrics || editingEntry.lyrics,
                        minusOneLink: matched?.minusOneLink || editingEntry.minusOneLink,
                      });
                    }}
                    suggestions={songTitleSuggestions}
                    placeholder="e.g. Dakilang Katapatan / Leave blank if undecided"
                    inputClassName="p-1.5 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Minus-One Link (YouTube / Audio Cloud Link)
                </label>
                <input
                  type="url"
                  value={editingEntry.minusOneLink || ''}
                  onChange={(e) => setEditingEntry({ ...editingEntry, minusOneLink: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Rehearsal / Practice Notes (Optional)
                </label>
                <input
                  type="text"
                  value={editingEntry.notes || ''}
                  onChange={(e) => setEditingEntry({ ...editingEntry, notes: e.target.value })}
                  placeholder="e.g. Practice on Saturday 4:00 PM, Key of D"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Lyrics / Performance Text (Optional)
                </label>
                <textarea
                  rows={4}
                  value={editingEntry.lyrics || ''}
                  onChange={(e) => setEditingEntry({ ...editingEntry, lyrics: e.target.value })}
                  placeholder="Paste lyrics or stanzas here..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-xs text-slate-900 dark:text-white"
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
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-white shadow-xs cursor-pointer"
                >
                  Save Special Song Number
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
