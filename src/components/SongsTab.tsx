import React, { useState, useEffect, useRef } from 'react';
import { Song, Setlist, SongAttachment, AttachmentCategory } from '../types';
import { isPastDate, formatDateStr } from '../utils/dateUtils';
import { formatDuplicateTitle } from '../utils/storage';
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
  CalendarPlus,
  Type,
  Check,
  FileImage,
  Link2,
  FileAudio,
  FileVideo,
  Copy,
  ArrowUpDown,
  Calendar,
  Volume2,
  ChevronDown,
  ChevronUp,
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
  collapseSignal?: number;
}

function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      return `https://www.youtube.com/embed/${match[2]}?autoplay=1`;
    }
  } catch {
    return null;
  }
  return null;
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
  collapseSignal,
}) => {
  const [selectedSongId, setSelectedSongId] = useState<string | null>(initialSelectedSongId || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<'alpha' | 'date'>('alpha');
  const [isEditing, setIsEditing] = useState(false);
  const [editingSong, setEditingSong] = useState<Partial<Song> | null>(null);
  const [showArtistInput, setShowArtistInput] = useState(false);

  // Large lyrics reading mode for stage worship singing
  const [largeFontMode, setLargeFontMode] = useState(false);

  // Active playing media for the in-line player right after lyrics
  const [activeMedia, setActiveMedia] = useState<{
    id: string;
    name: string;
    url: string;
    type: 'link' | 'audio' | 'video' | 'image' | 'text' | 'file';
  } | null>(null);

  // Add to Setlist Modal state
  const [isAddToSetlistOpen, setIsAddToSetlistOpen] = useState(false);
  const [targetSetlistId, setTargetSetlistId] = useState('');
  const [targetPart, setTargetPart] = useState<'sundaySchool' | 'worshipService'>('worshipService');
  const [addedNotice, setAddedNotice] = useState(false);
  const [copiedSongId, setCopiedSongId] = useState<string | null>(null);

  // Attachment adding modal state
  const [isAddingAttachment, setIsAddingAttachment] = useState(false);
  const [attachmentCategory, setAttachmentCategory] = useState<AttachmentCategory>('minus_one');
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentLinkOrData, setAttachmentLinkOrData] = useState('');
  const [attachmentType, setAttachmentType] = useState<'link' | 'audio' | 'video' | 'image' | 'text' | 'file'>('link');
  const [attachmentFileName, setAttachmentFileName] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const expandedItemRef = useRef<HTMLDivElement>(null);

  // Collapse active container if songs tab icon is tapped
  useEffect(() => {
    if (collapseSignal !== undefined && collapseSignal > 0) {
      setSelectedSongId(null);
      setIsEditing(false);
      setEditingSong(null);
      setIsAddToSetlistOpen(false);
      setIsAddingAttachment(false);
      setActiveMedia(null);
      onClearInitialSelectedSongId?.();
    }
  }, [collapseSignal, onClearInitialSelectedSongId]);

  // Back swipe / popstate listener to collapse container
  useEffect(() => {
    const handlePopState = () => {
      if (isEditing) {
        setIsEditing(false);
        setEditingSong(null);
        return;
      }
      if (isAddingAttachment) {
        setIsAddingAttachment(false);
        return;
      }
      if (isAddToSetlistOpen) {
        setIsAddToSetlistOpen(false);
        return;
      }
      if (selectedSongId) {
        setSelectedSongId(null);
        setActiveMedia(null);
        onClearInitialSelectedSongId?.();
        return;
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isEditing, isAddingAttachment, isAddToSetlistOpen, selectedSongId, onClearInitialSelectedSongId]);

  useEffect(() => {
    if (initialSelectedSongId) {
      setSelectedSongId(initialSelectedSongId);
      // Automatically scroll to the expanded item after render
      setTimeout(() => {
        expandedItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [initialSelectedSongId]);

  const handleCopySong = (song: Song, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const textToCopy = `Title: ${song.title}${song.artist ? `\nArtist/Author: ${song.artist}` : ''}\n\n${song.lyrics || '(No lyrics available)'}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedSongId(song.id);
    setTimeout(() => {
      setCopiedSongId(null);
    }, 2500);
  };

  // Sorting
  const sortedSongs = [...songs].sort((a, b) => {
    if (sortMode === 'date') {
      const dateA = a.updatedAt || '';
      const dateB = b.updatedAt || '';
      return dateB.localeCompare(dateA) || a.title.localeCompare(b.title);
    }
    return a.title.localeCompare(b.title);
  });

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

  const newestUpcomingSetlist = upcomingSetlists.length > 0 ? upcomingSetlists[0] : null;

  const handleStartCreateSong = () => {
    setEditingSong({
      id: `song-${Date.now()}`,
      title: '',
      artist: '',
      lyrics: '',
      attachments: [],
      updatedAt: new Date().toISOString(),
    });
    setShowArtistInput(false);
    setIsEditing(true);
  };

  const handleStartEditSong = (song: Song, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingSong(JSON.parse(JSON.stringify(song)));
    setShowArtistInput(Boolean(song.artist && song.artist.trim().length > 0));
    setIsEditing(true);
  };

  const handleSaveSongForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSong || !editingSong.title?.trim()) return;

    const formattedTitle = formatDuplicateTitle(editingSong.title.trim(), songs, editingSong.id);

    const finalSong: Song = {
      id: editingSong.id || `song-${Date.now()}`,
      title: formattedTitle,
      artist: showArtistInput && editingSong.artist?.trim() ? editingSong.artist.trim() : undefined,
      lyrics: editingSong.lyrics || '',
      minusOneLink: editingSong.minusOneLink,
      attachments: editingSong.attachments || [],
      updatedAt: new Date().toISOString(),
    };

    onSaveSong(finalSong);
    setIsEditing(false);
    setSelectedSongId(finalSong.id);
  };

  const handleOpenAddAttachment = (category: AttachmentCategory = 'minus_one', e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setAttachmentCategory(category);
    setAttachmentName('');
    setAttachmentLinkOrData('');
    setAttachmentType('link');
    setAttachmentFileName('');
    setIsAddingAttachment(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let detectedType: 'audio' | 'video' | 'image' | 'file' = 'file';
    if (file.type.startsWith('audio/')) {
      detectedType = 'audio';
    } else if (file.type.startsWith('video/')) {
      detectedType = 'video';
    } else if (file.type.startsWith('image/')) {
      detectedType = 'image';
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAttachmentLinkOrData(result);
      setAttachmentType(detectedType);
      setAttachmentFileName(file.name);
      if (!attachmentName.trim()) {
        setAttachmentName(file.name.replace(/\.[^/.]+$/, ''));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAttachment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSong || !attachmentLinkOrData.trim()) return;

    const finalName =
      attachmentName.trim() ||
      (attachmentType === 'link' ? 'Web Track Link' : attachmentFileName || 'Audio/Video Track');

    const newAtt: SongAttachment = {
      id: `att-${Date.now()}`,
      name: finalName,
      category: attachmentCategory,
      type: attachmentType,
      urlOrData: attachmentLinkOrData.trim(),
      createdAt: new Date().toISOString().split('T')[0],
    };

    const updatedSong: Song = {
      ...selectedSong,
      attachments: [...(selectedSong.attachments || []), newAtt],
      updatedAt: new Date().toISOString(),
    };

    onSaveSong(updatedSong);
    setIsAddingAttachment(false);
    // Automatically play the newly added media
    setActiveMedia({
      id: newAtt.id,
      name: newAtt.name,
      url: newAtt.urlOrData,
      type: newAtt.type,
    });
  };

  const handleDeleteAttachment = (attId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedSong) return;
    const updated = (selectedSong.attachments || []).filter((a) => a.id !== attId);
    onSaveSong({ ...selectedSong, attachments: updated, updatedAt: new Date().toISOString() });
    if (activeMedia?.id === attId) {
      setActiveMedia(null);
    }
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
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Music className="w-5 h-5 text-slate-800 dark:text-slate-200" />
            <span>Shared Song Library</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Central repository for praise & worship songs, hymns, plus-ones, and minus-ones
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

      {/* Search Bar & Interactive Sort Toggle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort Toggle Button (Tap to switch between A-Z and Date/Newest) */}
        <button
          type="button"
          onClick={() => setSortMode(sortMode === 'alpha' ? 'date' : 'alpha')}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600 transition-all shadow-xs cursor-pointer select-none shrink-0"
          title="Tap to toggle sorting order"
        >
          <ArrowUpDown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>
            {sortMode === 'alpha' ? 'Sorted A–Z (Tap to switch)' : 'Newest on Top (Tap to switch)'}
          </span>
        </button>
      </div>

      {/* Song List Header */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          All Songs ({filteredSongs.length})
        </span>
        <span className="text-xs text-slate-400">
          {sortMode === 'alpha' ? 'Alphabetical A–Z' : 'Date / Newest'}
        </span>
      </div>

      {/* Songs List with In-Place Accordion Expansion */}
      {filteredSongs.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
          No songs found matching "{searchQuery}".
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSongs.map((song) => {
            const isSelected = selectedSongId === song.id;
            const attachments = song.attachments || [];
            const plusOneList = attachments.filter((a) => a.category === 'plus_one');
            const minusOneList = attachments.filter((a) => a.category === 'minus_one' || !a.category);
            const hasAttachments = attachments.length > 0 || Boolean(song.minusOneLink);

            return (
              <div
                key={song.id}
                ref={isSelected ? expandedItemRef : null}
                className={`rounded-2xl transition-all border overflow-hidden ${
                  isSelected
                    ? 'bg-white dark:bg-slate-900 border-slate-900 dark:border-slate-100 ring-2 ring-slate-900 dark:ring-slate-100 shadow-lg'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 shadow-xs'
                }`}
              >
                {/* Song Card Header (Click to expand / collapse in-place) */}
                <div
                  onClick={() => {
                    if (isSelected) {
                      setSelectedSongId(null);
                      setActiveMedia(null);
                      onClearInitialSelectedSongId?.();
                    } else {
                      setSelectedSongId(song.id);
                      setActiveMedia(null);
                    }
                  }}
                  className="p-4 flex items-center justify-between cursor-pointer select-none group"
                >
                  <div className="min-w-0 pr-3">
                    <h4 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors truncate">
                      {song.title}
                    </h4>
                    {song.artist && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {song.artist}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleCopySong(song, e)}
                      className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Copy Song Title and Lyrics"
                    >
                      {copiedSongId === song.id ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>

                    {attachments.length > 0 && (
                      <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold border border-slate-200 dark:border-slate-700">
                        {attachments.length} {attachments.length === 1 ? 'track' : 'tracks'}
                      </span>
                    )}

                    <div className="p-1 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-transform">
                      {isSelected ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>
                  </div>
                </div>

                {/* IN-LINE EXPANDED VIEW (When clicked directly in place!) */}
                {isSelected && (
                  <div className="px-4 sm:px-6 pb-6 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-5">
                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleCopySong(song)}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Copy Title and Lyrics"
                        >
                          {copiedSongId === song.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => {
                            setTargetSetlistId(newestUpcomingSetlist ? newestUpcomingSetlist.id : 'NEW');
                            setIsAddToSetlistOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold flex items-center gap-1.5 shadow-xs hover:bg-slate-800 dark:hover:bg-white cursor-pointer"
                        >
                          <CalendarPlus className="w-3.5 h-3.5" />
                          <span>Add to Setlist</span>
                        </button>

                        <button
                          onClick={() => setLargeFontMode(!largeFontMode)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                            largeFontMode
                              ? 'bg-amber-100 dark:bg-amber-950/70 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                              : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                          title="Toggle Stage Font Size"
                        >
                          <Type className="w-3.5 h-3.5" />
                          <span>{largeFontMode ? 'Standard Font' : 'Stage Font'}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleStartEditSong(song, e)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        <button
                          onClick={() => {
                            if (confirm(`Remove "${song.title}" from Song Library?`)) {
                              onDeleteSong(song.id);
                              setSelectedSongId(null);
                              onClearInitialSelectedSongId?.();
                            }
                          }}
                          className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs cursor-pointer"
                          title="Delete Song"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => {
                            setSelectedSongId(null);
                            setActiveMedia(null);
                            onClearInitialSelectedSongId?.();
                          }}
                          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-xs transition-colors cursor-pointer"
                          title="Close"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Lyrics Block */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <BookOpen className="w-4 h-4" />
                          <span>Lyrics</span>
                        </span>
                        <span className="text-xs text-slate-400">
                          {largeFontMode ? 'Stage Size (Large)' : 'Standard Size'}
                        </span>
                      </div>

                      <div
                        className={`p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 whitespace-pre-wrap transition-all select-text ${
                          largeFontMode
                            ? 'text-lg sm:text-xl font-medium leading-relaxed font-sans'
                            : 'text-sm leading-relaxed font-mono'
                        }`}
                      >
                        {song.lyrics || (
                          <span className="text-slate-400 italic">No lyrics entered yet for this song.</span>
                        )}
                      </div>
                    </div>

                    {/* VIDEO / SOUND PLAYER (Placed right after the lyrics!) */}
                    {activeMedia && (
                      <div className="p-4 rounded-2xl bg-slate-900 text-white dark:bg-slate-950 border border-slate-800 shadow-md space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                          <div className="flex items-center space-x-2 min-w-0">
                            <Volume2 className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                            <span className="text-xs font-bold truncate">
                              Playing: {activeMedia.name}
                            </span>
                          </div>
                          <button
                            onClick={() => setActiveMedia(null)}
                            className="text-slate-400 hover:text-white p-1 cursor-pointer"
                            title="Close Player"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* YouTube Embed Player */}
                        {(() => {
                          const ytEmbed = getYouTubeEmbedUrl(activeMedia.url);
                          if (ytEmbed) {
                            return (
                              <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
                                <iframe
                                  src={ytEmbed}
                                  title={activeMedia.name}
                                  className="w-full h-full border-0"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                />
                              </div>
                            );
                          }

                          if (activeMedia.type === 'video' || activeMedia.url.startsWith('data:video/')) {
                            return (
                              <video
                                src={activeMedia.url}
                                controls
                                autoPlay
                                className="w-full max-h-72 rounded-xl bg-black"
                              />
                            );
                          }

                          if (activeMedia.type === 'audio' || activeMedia.url.startsWith('data:audio/')) {
                            return (
                              <div className="p-2 bg-slate-800/80 rounded-xl">
                                <audio src={activeMedia.url} controls autoPlay className="w-full" />
                              </div>
                            );
                          }

                          // Other web links
                          return (
                            <div className="p-3 rounded-xl bg-slate-800/80 flex items-center justify-between text-xs">
                              <span className="truncate pr-2">{activeMedia.url}</span>
                              <a
                                href={activeMedia.url}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold flex items-center gap-1 shrink-0"
                              >
                                <span>Open Link</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Categorized Attachments (Plus One & Minus One) */}
                    {hasAttachments && (
                      <div className="space-y-4 pt-1">
                        {/* Plus One (+1) Section */}
                        {plusOneList.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                              Plus One (+1) Reference Tracks & Files ({plusOneList.length})
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {plusOneList.map((att) => {
                                const isPlaying = activeMedia?.id === att.id;
                                return (
                                  <div
                                    key={att.id}
                                    onClick={() =>
                                      setActiveMedia({
                                        id: att.id,
                                        name: att.name,
                                        url: att.urlOrData,
                                        type: att.type,
                                      })
                                    }
                                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                                      isPlaying
                                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 ring-1 ring-amber-400'
                                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                                    }`}
                                  >
                                    <div className="flex items-center space-x-2.5 min-w-0">
                                      <div className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shrink-0">
                                        {att.type === 'video' ? (
                                          <FileVideo className="w-3.5 h-3.5 text-rose-500" />
                                        ) : att.type === 'audio' ? (
                                          <FileAudio className="w-3.5 h-3.5 text-amber-500" />
                                        ) : att.type === 'image' ? (
                                          <FileImage className="w-3.5 h-3.5 text-emerald-500" />
                                        ) : (
                                          <Link2 className="w-3.5 h-3.5 text-blue-500" />
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                                          {att.name}
                                        </span>
                                        <span className="text-[10px] text-slate-400 block truncate">
                                          {isPlaying ? 'Now Playing' : 'Click to play / preview'}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <Play className="w-3.5 h-3.5 text-slate-500 hover:text-amber-500" />
                                      <button
                                        type="button"
                                        onClick={(e) => handleDeleteAttachment(att.id, e)}
                                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                                        title="Delete attachment"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Minus One (-1) Section */}
                        {(minusOneList.length > 0 || song.minusOneLink) && (
                          <div className="space-y-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                              Minus One (-1) Instrumental Tracks ({minusOneList.length + (song.minusOneLink ? 1 : 0)})
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {song.minusOneLink && (
                                <div
                                  onClick={() =>
                                    setActiveMedia({
                                      id: `legacy-${song.id}`,
                                      name: `${song.title} (Minus One Link)`,
                                      url: song.minusOneLink!,
                                      type: 'link',
                                    })
                                  }
                                  className="p-3 rounded-xl border bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-400 flex items-center justify-between cursor-pointer transition-all"
                                >
                                  <div className="flex items-center space-x-2.5 min-w-0">
                                    <div className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shrink-0">
                                      <Play className="w-3.5 h-3.5 text-amber-500" />
                                    </div>
                                    <div className="min-w-0">
                                      <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                                        Minus One Track
                                      </span>
                                      <span className="text-[10px] text-slate-400 block truncate">
                                        {song.minusOneLink}
                                      </span>
                                    </div>
                                  </div>
                                  <Play className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                </div>
                              )}

                              {minusOneList.map((att) => {
                                const isPlaying = activeMedia?.id === att.id;
                                return (
                                  <div
                                    key={att.id}
                                    onClick={() =>
                                      setActiveMedia({
                                        id: att.id,
                                        name: att.name,
                                        url: att.urlOrData,
                                        type: att.type,
                                      })
                                    }
                                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                                      isPlaying
                                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 ring-1 ring-amber-400'
                                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                                    }`}
                                  >
                                    <div className="flex items-center space-x-2.5 min-w-0">
                                      <div className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shrink-0">
                                        {att.type === 'video' ? (
                                          <FileVideo className="w-3.5 h-3.5 text-rose-500" />
                                        ) : att.type === 'audio' ? (
                                          <FileAudio className="w-3.5 h-3.5 text-amber-500" />
                                        ) : att.type === 'image' ? (
                                          <FileImage className="w-3.5 h-3.5 text-emerald-500" />
                                        ) : (
                                          <Link2 className="w-3.5 h-3.5 text-blue-500" />
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                                          {att.name}
                                        </span>
                                        <span className="text-[10px] text-slate-400 block truncate">
                                          {isPlaying ? 'Now Playing' : 'Click to play / preview'}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <Play className="w-3.5 h-3.5 text-slate-500 hover:text-amber-500" />
                                      <button
                                        type="button"
                                        onClick={(e) => handleDeleteAttachment(att.id, e)}
                                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                                        title="Delete attachment"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Centered "+ Add Attachment" Button at the bottom (Requirement 10) */}
                    <div className="flex justify-center pt-2">
                      <button
                        type="button"
                        onClick={(e) => handleOpenAddAttachment('minus_one', e)}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 transition-all cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span>+ Add Attachment</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: ADD TO SETLIST */}
      {isAddToSetlistOpen && selectedSong && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarPlus className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                <span>Add "{selectedSong.title}" to Setlist</span>
              </h3>
              <button onClick={() => setIsAddToSetlistOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
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
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
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
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
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
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteAddToSetlist}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-sm cursor-pointer"
                >
                  {targetSetlistId === 'NEW' ? 'Create New Setlist' : 'Add to Setlist'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD ATTACHMENT / TRACKS (Requirement 7) */}
      {isAddingAttachment && selectedSong && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-amber-500" />
                <span>Add Track or Attachment</span>
              </h3>
              <button onClick={() => setIsAddingAttachment(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAttachment} className="p-5 space-y-4">
              {/* Category Choice: Plus One vs. Minus One */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Attachment Category *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAttachmentCategory('plus_one')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                      attachmentCategory === 'plus_one'
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Plus One (+1)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttachmentCategory('minus_one')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                      attachmentCategory === 'minus_one'
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Minus One (-1)
                  </button>
                </div>
              </div>

              {/* Title / Description */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Track / Attachment Title
                </label>
                <input
                  type="text"
                  value={attachmentName}
                  onChange={(e) => setAttachmentName(e.target.value)}
                  placeholder={
                    attachmentCategory === 'plus_one'
                      ? 'e.g. Vocal Reference / Studio Version'
                      : 'e.g. Acoustic Backing Track / Key of G'
                  }
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              {/* Link Input Box with Attachment Icon on the farthest right */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Paste Web / YouTube Link or Attach Sound/Video File *
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    required
                    value={attachmentFileName ? `Attached File: ${attachmentFileName}` : attachmentLinkOrData}
                    onChange={(e) => {
                      setAttachmentFileName('');
                      setAttachmentType('link');
                      setAttachmentLinkOrData(e.target.value);
                    }}
                    placeholder="https://www.youtube.com/watch?v=... or https://drive.google.com/..."
                    className="w-full pr-10 pl-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400"
                  />
                  {/* File Upload Trigger Icon at the farthest right */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute right-2 p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                    title="Attach Audio, Video, or Image file from device"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*,video/*,image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Paste any YouTube/audio link or click the paperclip icon on the right to attach sound or video files.
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddingAttachment(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-sm cursor-pointer"
                >
                  Save Attachment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CREATE / EDIT SONG (Requirements 7 & 8) */}
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
              <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSongForm} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Song Title (Required) */}
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
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white font-medium"
                />
              </div>

              {/* Optional Artist / Origin with "+ Add Artist/Origin" button (Requirement 8) */}
              <div>
                {showArtistInput ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Artist / Composer / Hymn Origin
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowArtistInput(false);
                          setEditingSong({ ...editingSong, artist: '' });
                        }}
                        className="text-[11px] text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                    <input
                      type="text"
                      value={editingSong.artist || ''}
                      onChange={(e) => setEditingSong({ ...editingSong, artist: e.target.value })}
                      placeholder="e.g. Papuri / Arnel De Pano / Hymn"
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                      autoFocus
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowArtistInput(true)}
                    className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer py-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add artist/origin</span>
                  </button>
                )}
              </div>

              {/* Lyrics Field */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Lyrics
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
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-sm cursor-pointer"
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
