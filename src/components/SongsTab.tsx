import React, { useState } from 'react';
import { Song, Setlist, SongAttachment } from '../types';
import { isPastDate, formatDateStr, getNextSundayStr } from '../utils/dateUtils';
import {
  Music,
  Plus,
  Search,
  BookOpen,
  ExternalLink,
  Paperclip,
  Trash2,
  Edit3,
  X,
  Play,
  Share2,
  CalendarPlus,
  Type,
  Check,
  FileImage,
  Link2,
  FileText,
  Eye,
} from 'lucide-react';

interface SongsTabProps {
  songs: Song[];
  setlists: Setlist[];
  onSaveSong: (song: Song) => void;
  onDeleteSong: (id: string) => void;
  onAddSongToNewSetlist: (song: Song) => void;
  onAddSongToExistingUpcomingSetlist: (song: Song, targetSetlistId: string, part: 'sundaySchool' | 'worshipService') => void;
  initialSelectedSongId?: string | null;
  onClearInitialSelectedSongId?: () => void;
}

export const SongsTab: React.FC<SongsTabProps> = ({
  songs,
  setlists,
  onSaveSong,
  onDeleteSong,
  onAddSongToNewSetlist,
  onAddSongToExistingUpcomingSetlist,
  initialSelectedSongId,
  onClearInitialSelectedSongId,
}) => {
  const [selectedSongId, setSelectedSongId] = useState<string | null>(initialSelectedSongId || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingSong, setEditingSong] = useState<Partial<Song> | null>(null);

  // Large lyrics reading mode for stage worship singing
  const [largeFontMode, setLargeFontMode] = useState(false);

  // Add to Setlist Modal state
  const [isAddToSetlistOpen, setIsAddToSetlistOpen] = useState(false);
  const [targetSetlistId, setTargetSetlistId] = useState('');
  const [targetPart, setTargetPart] = useState<'sundaySchool' | 'worshipService'>('worshipService');
  const [keyNoteInput, setKeyNoteInput] = useState('');
  const [addedNotice, setAddedNotice] = useState(false);

  // Attachment adding state
  const [isAddingAttachment, setIsAddingAttachment] = useState(false);
  const [attachmentForm, setAttachmentForm] = useState<{
    name: string;
    type: 'text' | 'link' | 'image';
    urlOrData: string;
  }>({
    name: '',
    type: 'text',
    urlOrData: '',
  });

  React.useEffect(() => {
    if (initialSelectedSongId) {
      setSelectedSongId(initialSelectedSongId);
    }
  }, [initialSelectedSongId]);

  // Alphabetical sort by title
  const sortedSongs = [...songs].sort((a, b) => a.title.localeCompare(b.title));

  const filteredSongs = sortedSongs.filter((song) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      song.title.toLowerCase().includes(q) ||
      (song.artist && song.artist.toLowerCase().includes(q)) ||
      song.lyrics.toLowerCase().includes(q)
    );
  });

  const selectedSong = songs.find((s) => s.id === selectedSongId);

  // Filter upcoming setlists that have not passed
  const upcomingSetlists = setlists
    .filter((s) => !isPastDate(s.date))
    .sort((a, b) => a.date.localeCompare(b.date));

  // The newest / soonest upcoming setlist
  const newestUpcomingSetlist = upcomingSetlists.length > 0 ? upcomingSetlists[0] : null;

  const handleStartCreateSong = () => {
    setEditingSong({
      id: `song-${Date.now()}`,
      title: '',
      artist: '',
      lyrics: '',
      minusOneLink: '',
      attachments: [],
      updatedAt: new Date().toISOString(),
    });
    setIsEditing(true);
  };

  const handleStartEditSong = (song: Song) => {
    setEditingSong(JSON.parse(JSON.stringify(song)));
    setIsEditing(true);
  };

  const handleSaveSongForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSong || !editingSong.title?.trim()) return;

    const finalSong: Song = {
      id: editingSong.id || `song-${Date.now()}`,
      title: editingSong.title.trim(),
      artist: editingSong.artist?.trim() || undefined,
      lyrics: editingSong.lyrics || '',
      minusOneLink: editingSong.minusOneLink?.trim() || undefined,
      attachments: editingSong.attachments || [],
      updatedAt: new Date().toISOString(),
    };

    onSaveSong(finalSong);
    setIsEditing(false);
    setSelectedSongId(finalSong.id);
  };

  const handleSaveAttachment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSong || !attachmentForm.name.trim() || !attachmentForm.urlOrData.trim()) return;

    const newAtt: SongAttachment = {
      id: `att-${Date.now()}`,
      name: attachmentForm.name.trim(),
      type: attachmentForm.type,
      urlOrData: attachmentForm.urlOrData.trim(),
      createdAt: new Date().toISOString().split('T')[0],
    };

    const updatedSong: Song = {
      ...selectedSong,
      attachments: [...(selectedSong.attachments || []), newAtt],
      updatedAt: new Date().toISOString(),
    };

    onSaveSong(updatedSong);
    setAttachmentForm({ name: '', type: 'text', urlOrData: '' });
    setIsAddingAttachment(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAttachmentForm({
        name: file.name,
        type: file.type.startsWith('image/') ? 'image' : 'text',
        urlOrData: result,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleExecuteAddToSetlist = () => {
    if (!selectedSong) return;

    if (targetSetlistId === 'NEW') {
      onAddSongToNewSetlist(selectedSong);
      setIsAddToSetlistOpen(false);
    } else if (targetSetlistId) {
      onAddSongToExistingUpcomingSetlist(selectedSong, targetSetlistId, targetPart);
      setIsAddToSetlistOpen(false);
      setAddedNotice(true);
      setTimeout(() => setAddedNotice(false), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Music className="w-5 h-5 text-slate-800 dark:text-slate-200" />
            <span>Shared Song Library</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Central repository for praise & worship songs, hymns, minus-ones, and chord sheets
          </p>
        </div>

        <button
          onClick={handleStartCreateSong}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold hover:bg-slate-800 dark:hover:bg-white transition-all shadow-sm shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Song</span>
        </button>
      </div>

      {addedNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>Song added to the selected upcoming setlist successfully!</span>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by song title, composer/artist, or lyrics phrase..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Selected Song Detail View */}
      {selectedSong && !isEditing && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-300 dark:border-slate-700 p-5 sm:p-6 shadow-md space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Song Library Entry
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
                {selectedSong.title}
              </h3>
              {selectedSong.artist && (
                <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400">
                  {selectedSong.artist}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setTargetSetlistId(newestUpcomingSetlist ? newestUpcomingSetlist.id : 'NEW');
                  setIsAddToSetlistOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold flex items-center gap-1.5 shadow-xs hover:bg-slate-800 dark:hover:bg-white"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                <span>Add to Setlist</span>
              </button>

              <button
                onClick={() => setLargeFontMode(!largeFontMode)}
                className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  largeFontMode
                    ? 'bg-amber-100 dark:bg-amber-950/70 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                    : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Toggle Large Font Reading Mode for Stage"
              >
                <Type className="w-4 h-4" />
                <span className="hidden sm:inline">{largeFontMode ? 'Standard Font' : 'Stage Font'}</span>
              </button>

              <button
                onClick={() => handleStartEditSong(selectedSong)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5"
              >
                <Edit3 className="w-4 h-4" />
                <span className="hidden sm:inline">Edit</span>
              </button>

              <button
                onClick={() => {
                  if (confirm(`Remove "${selectedSong.title}" from Song Library?`)) {
                    onDeleteSong(selectedSong.id);
                    setSelectedSongId(null);
                    onClearInitialSelectedSongId?.();
                  }
                }}
                className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Minus-One Link */}
          {selectedSong.minusOneLink && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center space-x-2.5 min-w-0">
                <Play className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                    Minus-One / Reference Track
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 truncate block">
                    {selectedSong.minusOneLink}
                  </span>
                </div>
              </div>
              <a
                href={selectedSong.minusOneLink}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shrink-0 ml-3 flex items-center gap-1 hover:opacity-90"
              >
                <span>Play / Open</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {/* Lyrics (Formatted for easy reading while leading singing) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4" />
                Lyrics (Worship Leader View)
              </span>
              <span className="text-xs text-slate-400">
                {largeFontMode ? 'Stage Size: 18px' : 'Standard Size'}
              </span>
            </div>

            <div
              className={`p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 whitespace-pre-wrap transition-all ${
                largeFontMode
                  ? 'text-lg sm:text-xl font-medium leading-relaxed font-sans'
                  : 'text-sm leading-relaxed font-mono'
              }`}
            >
              {selectedSong.lyrics || (
                <span className="text-slate-400 italic">No lyrics entered yet for this song.</span>
              )}
            </div>
          </div>

          {/* Attachments Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Paperclip className="w-4 h-4" />
                Attachments & Chord Sheets ({(selectedSong.attachments || []).length})
              </span>
              <button
                onClick={() => setIsAddingAttachment(true)}
                className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Attachment
              </button>
            </div>

            {(selectedSong.attachments || []).length === 0 ? (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500">
                No screenshots, chord sheets, or file attachments attached yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(selectedSong.attachments || []).map((att) => (
                  <div
                    key={att.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-start justify-between space-x-2"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center space-x-1.5">
                        {att.type === 'image' ? (
                          <FileImage className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : att.type === 'link' ? (
                          <Link2 className="w-4 h-4 text-blue-600 shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                        )}
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {att.name}
                        </span>
                      </div>

                      {att.type === 'text' && (
                        <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 whitespace-pre-wrap">
                          {att.urlOrData}
                        </div>
                      )}

                      {att.type === 'image' && (
                        <div className="mt-1">
                          <img
                            src={att.urlOrData}
                            alt={att.name}
                            className="max-h-40 rounded-lg object-contain border border-slate-200 dark:border-slate-700"
                          />
                        </div>
                      )}

                      {att.type === 'link' && (
                        <a
                          href={att.urlOrData}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 dark:text-blue-400 underline truncate block"
                        >
                          {att.urlOrData}
                        </a>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        const updated = (selectedSong.attachments || []).filter((a) => a.id !== att.id);
                        onSaveSong({ ...selectedSong, attachments: updated, updatedAt: new Date().toISOString() });
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Alphabetical Song List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            All Songs Alphabetical ({filteredSongs.length})
          </span>
          <span className="text-xs text-slate-400">Sorted A–Z</span>
        </div>

        {filteredSongs.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
            No songs found matching "{searchQuery}".
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {filteredSongs.map((song) => {
              const isSelected = selectedSongId === song.id;

              return (
                <div
                  key={song.id}
                  onClick={() => setSelectedSongId(isSelected ? null : song.id)}
                  className={`p-3.5 rounded-xl bg-white dark:bg-slate-900 border transition-all cursor-pointer hover:border-slate-400 dark:hover:border-slate-600 flex items-center justify-between ${
                    isSelected
                      ? 'border-slate-900 dark:border-slate-100 ring-1 ring-slate-900 dark:ring-slate-100 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="min-w-0 space-y-0.5">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {song.title}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {song.artist || 'Praise & Worship'}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0 ml-2">
                    {song.minusOneLink && (
                      <span className="p-1 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                        Track
                      </span>
                    )}
                    {(song.attachments || []).length > 0 && (
                      <span className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                        {song.attachments!.length} att
                      </span>
                    )}
                    <span className="text-xs font-semibold text-slate-400">
                      {isSelected ? 'Close' : 'View'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: ADD TO SETLIST */}
      {isAddToSetlistOpen && selectedSong && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarPlus className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                <span>Add "{selectedSong.title}" to Setlist</span>
              </h3>
              <button onClick={() => setIsAddToSetlistOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Target Setlist *
                </label>
                <select
                  value={targetSetlistId}
                  onChange={(e) => setTargetSetlistId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                >
                  {newestUpcomingSetlist && (
                    <option value={newestUpcomingSetlist.id}>
                      ★ Newest Upcoming: {formatDateStr(newestUpcomingSetlist.date, { showDayOfWeek: true })}
                    </option>
                  )}
                  {upcomingSetlists
                    .filter((s) => s.id !== newestUpcomingSetlist?.id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {formatDateStr(s.date, { showDayOfWeek: true })} (Presider: {s.presider})
                      </option>
                    ))}
                  <option value="NEW">+ Create a Brand New Setlist with this song</option>
                </select>
              </div>

              {targetSetlistId !== 'NEW' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Service Part *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTargetPart('sundaySchool')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center ${
                          targetPart === 'sundaySchool'
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        Sunday School
                      </button>
                      <button
                        type="button"
                        onClick={() => setTargetPart('worshipService')}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center ${
                          targetPart === 'worshipService'
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        Worship Service
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Note: Cannot add songs to past setlists per church program rules.
                  </p>
                </>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddToSetlistOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteAddToSetlist}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-sm"
                >
                  {targetSetlistId === 'NEW' ? 'Create New Setlist' : 'Add to Setlist'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD ATTACHMENT */}
      {isAddingAttachment && selectedSong && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                <span>Add Attachment / Materials</span>
              </h3>
              <button onClick={() => setIsAddingAttachment(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAttachment} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Attachment Name *
                </label>
                <input
                  type="text"
                  required
                  value={attachmentForm.name}
                  onChange={(e) => setAttachmentForm({ ...attachmentForm, name: e.target.value })}
                  placeholder="e.g. Chords Key of G / Lead Sheet / Screenshot"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Attachment Type
                </label>
                <select
                  value={attachmentForm.type}
                  onChange={(e) => setAttachmentForm({ ...attachmentForm, type: e.target.value as any })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                >
                  <option value="text">Chord Progression / Text Notes</option>
                  <option value="link">Web / Cloud Drive Link</option>
                  <option value="image">Uploaded Image / Screenshot</option>
                </select>
              </div>

              {attachmentForm.type === 'image' && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Upload Screenshot / Sheet Image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-200"
                  />
                </div>
              )}

              {attachmentForm.type !== 'image' && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    {attachmentForm.type === 'link' ? 'URL / Link *' : 'Chords / Text Content *'}
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={attachmentForm.urlOrData}
                    onChange={(e) => setAttachmentForm({ ...attachmentForm, urlOrData: e.target.value })}
                    placeholder={
                      attachmentForm.type === 'link'
                        ? 'https://drive.google.com/...'
                        : 'Intro: G - D - Em - C\nVerse: G - D - Em - C\nChorus: C - D - G'
                    }
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddingAttachment(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-sm"
                >
                  Save Attachment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CREATE / EDIT SONG */}
      {isEditing && editingSong && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Music className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                <span>
                  {songs.some((s) => s.id === editingSong.id) ? 'Edit Song' : 'Add New Song to Library'}
                </span>
              </h3>
              <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSongForm} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Song Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingSong.title || ''}
                    onChange={(e) => setEditingSong({ ...editingSong, title: e.target.value })}
                    placeholder="e.g. Dakilang Katapatan"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Artist / Composer / Hymn Origin
                  </label>
                  <input
                    type="text"
                    value={editingSong.artist || ''}
                    onChange={(e) => setEditingSong({ ...editingSong, artist: e.target.value })}
                    placeholder="e.g. Papuri / Arnel De Pano / Hymn"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Minus-One / Reference Track Link
                </label>
                <input
                  type="url"
                  value={editingSong.minusOneLink || ''}
                  onChange={(e) => setEditingSong({ ...editingSong, minusOneLink: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Lyrics (Formatted for Singing / Worship Leading)
                </label>
                <textarea
                  rows={9}
                  value={editingSong.lyrics || ''}
                  onChange={(e) => setEditingSong({ ...editingSong, lyrics: e.target.value })}
                  placeholder="[Verse 1]&#10;Type lyrics here...&#10;&#10;[Chorus]&#10;..."
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-sm"
                >
                  Save Song
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
