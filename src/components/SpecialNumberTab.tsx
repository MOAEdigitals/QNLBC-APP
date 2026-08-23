import React, { useState } from 'react';
import { SpecialNumberEntry, Song } from '../types';
import {
  formatDateStr,
  formatShortDate,
  isPastDate,
  isToday,
  getNextSundayStr,
  sortUpcomingFirst,
} from '../utils/dateUtils';
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
  UserCheck,
  Check,
  Search,
} from 'lucide-react';

interface SpecialNumberTabProps {
  specialNumbers: SpecialNumberEntry[];
  songs: Song[];
  onSaveSpecialNumber: (entry: SpecialNumberEntry) => void;
  onDeleteSpecialNumber: (id: string) => void;
  onOpenSongDetail: (songId: string) => void;
}

export const SpecialNumberTab: React.FC<SpecialNumberTabProps> = ({
  specialNumbers,
  songs,
  onSaveSpecialNumber,
  onDeleteSpecialNumber,
  onOpenSongDetail,
}) => {
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Partial<SpecialNumberEntry> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [syncedNotice, setSyncedNotice] = useState(false);

  // Sorted: soonest upcoming at top (nearest future/today first), past dates below
  const sortedEntries = sortUpcomingFirst<SpecialNumberEntry>(specialNumbers, (e: SpecialNumberEntry) => e.scheduledDate);

  const filteredEntries = sortedEntries.filter((item: SpecialNumberEntry) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.performerName.toLowerCase().includes(q) ||
      item.songTitle.toLowerCase().includes(q) ||
      (item.notes && item.notes.toLowerCase().includes(q))
    );
  });

  const selectedEntry = specialNumbers.find((e) => e.id === selectedEntryId);

  const handleStartCreate = () => {
    setEditingEntry({
      id: `sp-${Date.now()}`,
      performerName: '',
      scheduledDate: getNextSundayStr(),
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

  // If user selects an existing song from library, prefill lyrics and minus-one
  const handleSelectExistingSong = (song: Song) => {
    if (!editingEntry) return;
    setEditingEntry({
      ...editingEntry,
      songTitle: song.title,
      songId: song.id,
      lyrics: song.lyrics || editingEntry.lyrics,
      minusOneLink: song.minusOneLink || editingEntry.minusOneLink,
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry || !editingEntry.performerName?.trim() || !editingEntry.songTitle?.trim() || !editingEntry.scheduledDate) {
      return;
    }

    const finalEntry: SpecialNumberEntry = {
      id: editingEntry.id || `sp-${Date.now()}`,
      performerName: editingEntry.performerName.trim(),
      scheduledDate: editingEntry.scheduledDate,
      songTitle: editingEntry.songTitle.trim(),
      songId: editingEntry.songId,
      minusOneLink: editingEntry.minusOneLink?.trim() || undefined,
      notes: editingEntry.notes?.trim() || undefined,
      lyrics: editingEntry.lyrics || '',
      createdAt: editingEntry.createdAt || new Date().toISOString(),
    };

    onSaveSpecialNumber(finalEntry);
    setIsEditing(false);
    setSelectedEntryId(finalEntry.id);
    setSyncedNotice(true);
    setTimeout(() => setSyncedNotice(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Mic2 className="w-5 h-5 text-slate-800 dark:text-slate-200" />
            <span>Special Musical Numbers</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Dedicated schedule for solos, duets, choirs, and ensembles with minus-one & lyrics
          </p>
        </div>

        <button
          onClick={handleStartCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold hover:bg-slate-800 dark:hover:bg-white transition-all shadow-sm shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Schedule Number</span>
        </button>
      </div>

      {syncedNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>Saved special number! Song lyrics and materials were automatically updated in the Song Library.</span>
        </div>
      )}

      {/* Search */}
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

      {/* Selected Detail View */}
      {selectedEntry && !isEditing && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 p-5 sm:p-6 shadow-md space-y-5">
          <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Special Number Details
                </span>
                {isToday(selectedEntry.scheduledDate) ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white">
                    Today
                  </span>
                ) : !isPastDate(selectedEntry.scheduledDate) ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                    Upcoming Date
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    Past
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                {selectedEntry.songTitle}
              </h3>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Performer: {selectedEntry.performerName}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Scheduled for {formatDateStr(selectedEntry.scheduledDate, { showDayOfWeek: true })}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleStartEdit(selectedEntry)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5"
              >
                <Edit3 className="w-4 h-4" />
                <span className="hidden sm:inline">Edit</span>
              </button>
              <button
                onClick={() => {
                  if (confirm(`Remove special number entry for ${selectedEntry.songTitle}?`)) {
                    onDeleteSpecialNumber(selectedEntry.id);
                    setSelectedEntryId(null);
                  }
                }}
                className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-medium"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Minus-One Link */}
          {selectedEntry.minusOneLink && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center space-x-2.5 min-w-0">
                <Play className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                    Minus-One / Reference Track
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
                <span>Open Track</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {/* Notes */}
          {selectedEntry.notes && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Notes:</span>
              <p className="text-slate-600 dark:text-slate-400">{selectedEntry.notes}</p>
            </div>
          )}

          {/* Lyrics View */}
          {selectedEntry.lyrics ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  Lyrics & Materials (Synced with Song Library)
                </span>
                {selectedEntry.songId && (
                  <button
                    onClick={() => onOpenSongDetail(selectedEntry.songId!)}
                    className="text-xs text-slate-700 dark:text-slate-300 underline font-semibold"
                  >
                    Open in Library
                  </button>
                )}
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 font-mono text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                {selectedEntry.lyrics}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-500">
              No lyrics entered yet. Edit this entry to add lyrics.
            </div>
          )}
        </div>
      )}

      {/* Schedule List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Special Numbers Schedule ({filteredEntries.length})
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Soonest upcoming date is top
          </span>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
            No special numbers scheduled. Click "Schedule Number" to add one!
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredEntries.map((item, index) => {
              const isPast = isPastDate(item.scheduledDate);
              const today = isToday(item.scheduledDate);
              const isSelected = selectedEntryId === item.id;
              const isSoonestUpcoming = index === 0 && !isPast;

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedEntryId(isSelected ? null : item.id)}
                  className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all cursor-pointer hover:border-slate-400 dark:hover:border-slate-600 ${
                    isSelected
                      ? 'border-slate-900 dark:border-slate-100 ring-1 ring-slate-900 dark:ring-slate-100 shadow-sm'
                      : isSoonestUpcoming
                      ? 'border-amber-300 dark:border-amber-700/80 bg-amber-50/20 dark:bg-amber-950/10'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3.5 min-w-0">
                      <div
                        className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 border ${
                          today
                            ? 'bg-amber-500 text-white border-amber-600'
                            : !isPast
                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-800 dark:border-slate-200'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
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
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {item.songTitle}
                          </h4>
                          {isSoonestUpcoming && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200">
                              ★ Soonest Upcoming
                            </span>
                          )}
                          {today && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white">
                              Today
                            </span>
                          )}
                        </div>

                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                          {item.performerName}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          <span>{formatDateStr(item.scheduledDate, { showDayOfWeek: true })}</span>
                          {item.minusOneLink && (
                            <>
                              <span>•</span>
                              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                                <Play className="w-3 h-3" /> Track Ready
                              </span>
                            </>
                          )}
                          {item.lyrics && (
                            <>
                              <span>•</span>
                              <span>Lyrics available</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 text-slate-400 shrink-0 ml-2">
                      <span className="text-xs font-semibold hidden sm:inline text-slate-500">
                        {isSelected ? 'Close' : 'View'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isEditing && editingEntry && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Mic2 className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                <span>
                  {specialNumbers.some((s) => s.id === editingEntry.id)
                    ? 'Edit Special Musical Number'
                    : 'Schedule New Special Number'}
                </span>
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Performer / Group Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingEntry.performerName || ''}
                    onChange={(e) => setEditingEntry({ ...editingEntry, performerName: e.target.value })}
                    placeholder="e.g. NLBC Youth Choir / Sis. Abigail (Solo)"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                  />
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

              {/* Song Title & Quick Select from Song Library */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Song Title *
                  </label>
                  {songs.length > 0 && (
                    <span className="text-[11px] text-slate-400">
                      Or pick from Song Library
                    </span>
                  )}
                </div>

                <input
                  type="text"
                  required
                  value={editingEntry.songTitle || ''}
                  onChange={(e) => setEditingEntry({ ...editingEntry, songTitle: e.target.value })}
                  placeholder="e.g. Dakilang Katapatan / Goodness of God"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                />

                {/* Quick picker chips from existing library */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {songs.slice(0, 5).map((song) => (
                    <button
                      key={song.id}
                      type="button"
                      onClick={() => handleSelectExistingSong(song)}
                      className="px-2 py-1 rounded-md text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                    >
                      + {song.title}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Minus-One Link (YouTube / Audio / Cloud Link)
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

              {/* Lyrics with automatic Song Library sync note */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Lyrics & Song Materials
                  </label>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                    Auto-updates Tab 4 Song Library
                  </span>
                </div>
                <textarea
                  rows={6}
                  value={editingEntry.lyrics || ''}
                  onChange={(e) => setEditingEntry({ ...editingEntry, lyrics: e.target.value })}
                  placeholder="Type or paste lyrics here. Saving here automatically adds or updates the song in the shared Song Library..."
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 text-white text-xs font-semibold shadow-sm"
                >
                  Save & Sync to Library
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
