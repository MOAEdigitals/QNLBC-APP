import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Song, Setlist, SongAttachment, AttachmentCategory } from '../types';
import { isPastDate, formatDateStr } from '../utils/dateUtils';
import { formatDuplicateTitle, saveAudioToStorage } from '../utils/storage';
import { uploadMediaToCloudStorage } from '../services/cloudMediaStorage';
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
  CalendarPlus,
  Type,
  Check,
  FileImage,
  Link2,
  FileAudio,
  FileVideo,
  Copy,
  Volume2,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Repeat,
  Sparkles,
  BookmarkCheck,
  Clock,
  AlertTriangle,
  Radio,
  Cloud,
  Loader2,
  Tag,
  Filter,
} from 'lucide-react';
import {
  searchSong,
  getSongUsageHistory,
  getSongUsageHistoryFromMap,
  buildSongUsageMap,
  SongUsageHistory,
} from '../utils/songSearch';
import {
  resolveMediaUrl,
  getYouTubeEmbedUrl,
} from '../utils/mediaUtils';

interface SongsTabProps {
  songs: Song[];
  setlists: Setlist[];
  onSaveSong: (song: Song) => void;
  onBatchSaveSongs?: (songs: Song[]) => void;
  onDeleteSong: (id: string) => void;
  onAddSongToNewSetlist: (song: Song) => void;
  onAddSongToExistingUpcomingSetlist: (song: Song, targetSetlistId: string, part: 'sundaySchool' | 'worshipService') => void;
  initialSelectedSongId?: string | null;
  onClearInitialSelectedSongId?: () => void;
  collapseSignal?: number;
}

export const SongsTab: React.FC<SongsTabProps> = ({
  songs,
  setlists,
  onSaveSong,
  onBatchSaveSongs,
  onDeleteSong,
  onAddSongToNewSetlist,
  onAddSongToExistingUpcomingSetlist,
  initialSelectedSongId,
  onClearInitialSelectedSongId,
  collapseSignal,
}) => {
  const [selectedSongId, setSelectedSongId] = useState<string | null>(initialSelectedSongId || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<'alpha' | 'recent' | 'date' | 'category'>('alpha');
  const [categoryFilter, setCategoryFilter] = useState<
    'all' | 'Hymn' | 'Special' | 'Contemporary' | 'Choir' | 'Tagalog' | 'uncategorized'
  >('all');
  const [isEditing, setIsEditing] = useState(false);
  const [editingSong, setEditingSong] = useState<Partial<Song> | null>(null);
  const [showArtistInput, setShowArtistInput] = useState(false);
  const [isLyricsExpandedInEditor, setIsLyricsExpandedInEditor] = useState(false);

  // Category quick-picker popup state for song card
  const [categoryPickerSongId, setCategoryPickerSongId] = useState<string | null>(null);

  // 3-dot dropdown menu open state for song id
  const [openMenuSongId, setOpenMenuSongId] = useState<string | null>(null);

  // Repeat / Loop mode for audio & video player (resets on reload / sign out)
  const [isLooping, setIsLooping] = useState(false);

  // Background play mode for tracks & links to keep playing even when minimized
  const [isBgPlayEnabled, setIsBgPlayEnabled] = useState(false);

  // Large lyrics reading mode for stage worship singing
  const [largeFontMode, setLargeFontMode] = useState(false);

  // Active playing media for the in-line player right after lyrics
  const [activeMedia, setActiveMedia] = useState<{
    id: string;
    name: string;
    url: string;
    type: 'link' | 'audio' | 'video' | 'image' | 'text' | 'file';
  } | null>(null);

  // Background Audio / MediaSession integration when BG play is enabled
  useEffect(() => {
    if (!activeMedia) return;

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: activeMedia.name || 'Worship Track',
        artist: 'Church Song Library',
        album: 'Worship Service Resources',
      });

      navigator.mediaSession.setActionHandler('play', () => {
        const audioEl = document.querySelector('audio') as HTMLAudioElement | null;
        const videoEl = document.querySelector('video') as HTMLVideoElement | null;
        if (audioEl) audioEl.play().catch(() => {});
        if (videoEl) videoEl.play().catch(() => {});
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        const audioEl = document.querySelector('audio') as HTMLAudioElement | null;
        const videoEl = document.querySelector('video') as HTMLVideoElement | null;
        if (audioEl) audioEl.pause();
        if (videoEl) videoEl.pause();
      });
    }
  }, [activeMedia, isBgPlayEnabled]);

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
  const [isUploadingCloudMedia, setIsUploadingCloudMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const expandedItemRef = useRef<HTMLDivElement>(null);

  // Close 3-dot menus and category picker when clicking outside
  useEffect(() => {
    const handleGlobalClick = () => {
      setOpenMenuSongId(null);
      setCategoryPickerSongId(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const lastProcessedSignalRef = useRef<number>(0);

  // Songs Tab Click Action: Pressing tab again collapses open song; pressing once more scrolls to top
  useEffect(() => {
    if (collapseSignal !== undefined && collapseSignal > 0 && collapseSignal !== lastProcessedSignalRef.current) {
      lastProcessedSignalRef.current = collapseSignal;

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

      // Step 1: If an expanded song is open, pressing the tab collapses it
      if (selectedSongId) {
        setSelectedSongId(null);
        setActiveMedia(null);
        setOpenMenuSongId(null);
        setCategoryPickerSongId(null);
        onClearInitialSelectedSongId?.();
        return;
      }

      // Step 2: Pressing once more after that scrolls back to the top of the song list
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [collapseSignal, selectedSongId, isEditing, isAddingAttachment, isAddToSetlistOpen, onClearInitialSelectedSongId]);

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
        setOpenMenuSongId(null);
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

  // Fast O(1) cached usage map
  const usageMap = useMemo(() => buildSongUsageMap(setlists), [setlists]);

  // Sorting: strictly A-Z, Recent, Newest, or Category (memoized)
  const sortedSongs = useMemo(() => {
    return [...songs].sort((a, b) => {
      if (sortMode === 'recent') {
        const historyA = getSongUsageHistoryFromMap(a.title, usageMap);
        const historyB = getSongUsageHistoryFromMap(b.title, usageMap);
        const dateA = historyA.lastDate || '';
        const dateB = historyB.lastDate || '';
        // Most recently used setlist date comes first
        if (dateA && !dateB) return -1;
        if (!dateA && dateB) return 1;
        if (dateA && dateB && dateA !== dateB) return dateB.localeCompare(dateA);
        return a.title.localeCompare(b.title);
      }
      if (sortMode === 'date') {
        const dateA = a.updatedAt || '';
        const dateB = b.updatedAt || '';
        return dateB.localeCompare(dateA) || a.title.localeCompare(b.title);
      }
      if (sortMode === 'category') {
        const categoryPriority: Record<string, number> = {
          Hymn: 1,
          Special: 2,
          Contemporary: 3,
          Choir: 4,
          Tagalog: 5,
        };
        const pA = a.category ? categoryPriority[a.category] || 6 : 7;
        const pB = b.category ? categoryPriority[b.category] || 6 : 7;
        if (pA !== pB) return pA - pB;
        return a.title.localeCompare(b.title);
      }
      return a.title.localeCompare(b.title);
    });
  }, [songs, sortMode, usageMap]);

  // Category counts across library
  const categoryCounts = useMemo(() => {
    let hymn = 0;
    let special = 0;
    let contemporary = 0;
    let choir = 0;
    let tagalog = 0;
    let uncategorized = 0;
    for (const s of songs) {
      if (s.category === 'Hymn') hymn++;
      else if (s.category === 'Special') special++;
      else if (s.category === 'Contemporary') contemporary++;
      else if (s.category === 'Choir') choir++;
      else if (s.category === 'Tagalog') tagalog++;
      else uncategorized++;
    }
    return { Hymn: hymn, Special: special, Contemporary: contemporary, Choir: choir, Tagalog: tagalog, uncategorized };
  }, [songs]);

  // Category Filtered Songs
  const categoryFilteredSongs = useMemo(() => {
    if (categoryFilter === 'all') return sortedSongs;
    if (categoryFilter === 'uncategorized') {
      return sortedSongs.filter(
        (s) => !s.category || !['Hymn', 'Special', 'Contemporary', 'Choir', 'Tagalog'].includes(s.category)
      );
    }
    return sortedSongs.filter((s) => s.category === categoryFilter);
  }, [sortedSongs, categoryFilter]);

  const songSearchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return categoryFilteredSongs.map((song) => ({
        song,
        matches: true,
        score: 100,
        matchedField: 'none' as const,
        lyricSnippet: undefined,
        history: getSongUsageHistoryFromMap(song.title, usageMap),
      }));
    }

    const results = categoryFilteredSongs
      .map((song) => {
        const searchRes = searchSong(song, searchQuery);
        const history = getSongUsageHistoryFromMap(song.title, usageMap);
        return {
          ...searchRes,
          history,
        };
      })
      .filter((r) => r.matches);

    // When actively searching, sort by search match relevance score descending
    results.sort((a, b) => b.score - a.score);
    return results;
  }, [categoryFilteredSongs, searchQuery, usageMap]);

  const filteredSongs = useMemo(() => songSearchResults.map((r) => r.song), [songSearchResults]);

  const selectedSong = useMemo(() => songs.find((s) => s.id === selectedSongId), [songs, selectedSongId]);

  // Filter upcoming setlists that have not passed
  const upcomingSetlists = useMemo(() => {
    return setlists
      .filter((s) => !isPastDate(s.date))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [setlists]);

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
    setOpenMenuSongId(null);
    setEditingSong(JSON.parse(JSON.stringify(song)));
    setShowArtistInput(Boolean(song.artist && song.artist.trim().length > 0));
    setIsEditing(true);
  };

  const handleToggleThemeSong = (song: Song, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setOpenMenuSongId(null);
    const updated: Song = {
      ...song,
      isThemeSong: !song.isThemeSong,
      updatedAt: new Date().toISOString(),
    };
    onSaveSong(updated);
  };

  const handleToggleWelcomeSong = (song: Song, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setOpenMenuSongId(null);
    const updated: Song = {
      ...song,
      isWelcomeSong: !song.isWelcomeSong,
      updatedAt: new Date().toISOString(),
    };
    onSaveSong(updated);
  };

  const handleToggleClosingSong = (song: Song, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setOpenMenuSongId(null);
    const updated: Song = {
      ...song,
      isClosingSong: !song.isClosingSong,
      updatedAt: new Date().toISOString(),
    };
    onSaveSong(updated);
  };

  const handleUpdateSongCategory = (
    song: Song,
    category: 'Hymn' | 'Special' | 'Contemporary' | 'Choir' | 'Tagalog' | undefined,
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    setOpenMenuSongId(null);
    setCategoryPickerSongId(null);
    const updated: Song = {
      ...song,
      category,
      updatedAt: new Date().toISOString(),
    };
    onSaveSong(updated);
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
      category: editingSong.category,
      minusOneLink: editingSong.minusOneLink,
      attachments: editingSong.attachments || [],
      isThemeSong: editingSong.isThemeSong,
      isWelcomeSong: editingSong.isWelcomeSong,
      isClosingSong: editingSong.isClosingSong,
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    const attId = `att-${Date.now()}`;
    setIsUploadingCloudMedia(true);
    setUploadProgress(10);
    setUploadStatusText(`Uploading "${file.name}" to Universal Cloud Media Storage...`);

    try {
      const uploadRes = await uploadMediaToCloudStorage(
        file,
        attId,
        file.name,
        (pct) => {
          setUploadProgress(pct);
          setUploadStatusText(`Uploading "${file.name}" (${pct}%)...`);
        }
      );

      setAttachmentLinkOrData(uploadRes.url);
      setAttachmentType(detectedType);
      setAttachmentFileName(file.name);
      if (!attachmentName.trim()) {
        setAttachmentName(file.name.replace(/\.[^/.]+$/, ''));
      }
    } catch (err) {
      console.warn('Fallback saving file to IndexedDB:', err);
      const reader = new FileReader();
      reader.onload = async () => {
        const result = reader.result as string;
        await saveAudioToStorage(attId, result, file.name);
        setAttachmentLinkOrData(`indexeddb:${attId}`);
        setAttachmentType(detectedType);
        setAttachmentFileName(file.name);
        if (!attachmentName.trim()) {
          setAttachmentName(file.name.replace(/\.[^/.]+$/, ''));
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploadingCloudMedia(false);
      setUploadProgress(0);
      setUploadStatusText('');
    }
  };

  const handleSaveAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSong || !attachmentLinkOrData.trim()) return;

    const finalName =
      attachmentName.trim() ||
      (attachmentType === 'link' ? 'Web Track Link' : attachmentFileName || 'Audio/Video Track');

    let finalUrl = attachmentLinkOrData.trim();
    const attId = `att-${Date.now()}`;
    if (finalUrl.startsWith('data:')) {
      try {
        const res = await uploadMediaToCloudStorage(finalUrl, attId, finalName);
        finalUrl = res.url;
      } catch {
        await saveAudioToStorage(attId, finalUrl, finalName);
        finalUrl = `indexeddb:${attId}`;
      }
    }

    const newAtt: SongAttachment = {
      id: attId,
      name: finalName,
      category: attachmentCategory,
      type: attachmentType,
      urlOrData: finalUrl,
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
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Music className="w-5 h-5 text-slate-800 dark:text-slate-200" />
            <span>Shared Song Library</span>
          </h2>
        </div>
      </div>

      {addedNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>Song added to the selected upcoming setlist successfully!</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by song title, composer/artist, or lyrics phrase..."
          className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-colors"
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

      {/* Category Filter Pills */}
      <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs pt-0.5">
        <button
          type="button"
          onClick={() => setCategoryFilter('all')}
          className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer select-none flex items-center gap-1.5 ${
            categoryFilter === 'all'
              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <span>All</span>
          <span className="text-[10px] opacity-75">({songs.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setCategoryFilter('Hymn')}
          className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer select-none flex items-center gap-1.5 ${
            categoryFilter === 'Hymn'
              ? 'bg-emerald-600 dark:bg-emerald-500 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
          }`}
        >
          <span>Hymns</span>
          <span className="text-[10px] opacity-80">({categoryCounts.Hymn})</span>
        </button>

        <button
          type="button"
          onClick={() => setCategoryFilter('Special')}
          className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer select-none flex items-center gap-1.5 ${
            categoryFilter === 'Special'
              ? 'bg-purple-600 dark:bg-purple-500 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-900/60 hover:bg-purple-50 dark:hover:bg-purple-950/40'
          }`}
        >
          <span>Special</span>
          <span className="text-[10px] opacity-80">({categoryCounts.Special})</span>
        </button>

        <button
          type="button"
          onClick={() => setCategoryFilter('Contemporary')}
          className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer select-none flex items-center gap-1.5 ${
            categoryFilter === 'Contemporary'
              ? 'bg-cyan-600 dark:bg-cyan-500 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-900/60 hover:bg-cyan-50 dark:hover:bg-cyan-950/40'
          }`}
        >
          <span>Contemporary</span>
          <span className="text-[10px] opacity-80">({categoryCounts.Contemporary})</span>
        </button>

        <button
          type="button"
          onClick={() => setCategoryFilter('Choir')}
          className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer select-none flex items-center gap-1.5 ${
            categoryFilter === 'Choir'
              ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
          }`}
        >
          <span>Choir</span>
          <span className="text-[10px] opacity-80">({categoryCounts.Choir})</span>
        </button>

        <button
          type="button"
          onClick={() => setCategoryFilter('Tagalog')}
          className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer select-none flex items-center gap-1.5 ${
            categoryFilter === 'Tagalog'
              ? 'bg-amber-600 dark:bg-amber-500 text-white shadow-xs'
              : 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60 hover:bg-amber-50 dark:hover:bg-amber-950/40'
          }`}
        >
          <span>Tagalog</span>
          <span className="text-[10px] opacity-80">({categoryCounts.Tagalog})</span>
        </button>

        {categoryCounts.uncategorized > 0 && (
          <button
            type="button"
            onClick={() => setCategoryFilter('uncategorized')}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer select-none flex items-center gap-1.5 ${
              categoryFilter === 'uncategorized'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>Uncategorized</span>
            <span className="text-[10px] opacity-75">({categoryCounts.uncategorized})</span>
          </button>
        )}
      </div>

      {/* Song List Header with Sorted buttons (A-Z, Recent, Newest, Category) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {categoryFilter !== 'all' ? `${categoryFilter} Songs` : 'All Songs'} ({filteredSongs.length})
        </span>

        {/* Sorted button located on the right (4 options: A-Z, Recent, Newest, Category) */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-xs font-semibold overflow-x-auto">
          <span className="text-[11px] text-slate-400 font-medium pl-1.5 pr-0.5">Sort:</span>
          <button
            type="button"
            onClick={() => setSortMode('alpha')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer select-none whitespace-nowrap ${
              sortMode === 'alpha'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            A–Z
          </button>
          <button
            type="button"
            onClick={() => setSortMode('recent')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer select-none whitespace-nowrap ${
              sortMode === 'recent'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
            title="Sort by most recently sung in setlists"
          >
            Recent
          </button>
          <button
            type="button"
            onClick={() => setSortMode('date')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer select-none whitespace-nowrap ${
              sortMode === 'date'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
            title="Sort by newly added/updated in library"
          >
            Newest
          </button>
          <button
            type="button"
            onClick={() => setSortMode('category')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer select-none whitespace-nowrap ${
              sortMode === 'category'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
            title="Sort grouped by Category (Hymns first, then Special, Contemporary)"
          >
            Category
          </button>
        </div>
      </div>

      {/* Songs List with In-Place Accordion Expansion */}
      {songSearchResults.length === 0 ? (
        <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
          No songs found matching "{searchQuery}".
        </div>
      ) : (
        <div className="space-y-3">
          {songSearchResults.map((result) => {
            const { song, history, matchedField, lyricSnippet } = result;
            const isSelected = selectedSongId === song.id;
            const attachments = song.attachments || [];
            const plusOneList = attachments.filter((a) => a.category === 'plus_one');
            const minusOneList = attachments.filter((a) => a.category === 'minus_one' || !a.category);
            const hasLegacyMinusOne = Boolean(song.minusOneLink && !attachments.some((a) => a.urlOrData === song.minusOneLink));
            const totalTrackCount = attachments.length + (hasLegacyMinusOne ? 1 : 0);
            const hasAttachments = totalTrackCount > 0;
            const isMenuOpen = openMenuSongId === song.id;

            return (
              <div
                key={song.id}
                id={`song-card-${song.id}`}
                ref={isSelected ? expandedItemRef : null}
                className={`rounded-2xl transition-all border overflow-hidden ${
                  isSelected
                    ? 'bg-white dark:bg-slate-900 border-slate-900 dark:border-slate-100 ring-2 ring-slate-900 dark:ring-slate-100 shadow-md'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 shadow-xs'
                }`}
              >
                {/* Song Card Header (Tapping/clicking expands/collapses in-place) */}
                <div
                  onClick={() => {
                    if (isSelected) {
                      setSelectedSongId(null);
                      setActiveMedia(null);
                      setOpenMenuSongId(null);
                      onClearInitialSelectedSongId?.();
                    } else {
                      setSelectedSongId(song.id);
                      setActiveMedia(null);
                      setOpenMenuSongId(null);
                    }
                  }}
                  className="p-4 flex items-center justify-between cursor-pointer select-none group"
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors truncate">
                        {song.title}
                      </h4>

                      {/* Theme Song Badge */}
                      {song.isThemeSong && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/80">
                          Theme Song
                        </span>
                      )}

                      {/* Welcome Song Badge */}
                      {song.isWelcomeSong && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                          Welcome
                        </span>
                      )}

                      {/* Closing Song Badge */}
                      {song.isClosingSong && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          Closing
                        </span>
                      )}

                      {/* Repetition Warning: Sung recently (within 14 days) */}
                      {history.isRecent && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60 shrink-0"
                          title={`Sung recently on ${history.formattedLastDate || 'recent date'}`}
                        >
                          <AlertTriangle className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                          <span>Sung {history.relativeTimeAgo}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap mt-0.5">
                      {song.artist && <span className="truncate">{song.artist}</span>}
                      {song.artist && <span className="opacity-30">•</span>}
                      {history.relativeTimeAgo ? (
                        <span className="text-slate-400 dark:text-slate-500 flex items-center gap-1 text-[11px]">
                          <Clock className="w-3 h-3 opacity-60 inline" />
                          <span>Last sung: {history.relativeTimeAgo}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400/70 dark:text-slate-600 text-[11px]">
                          Not scheduled yet
                        </span>
                      )}
                    </div>

                    {/* Matched Lyric Snippet on Search */}
                    {matchedField === 'lyrics' && lyricSnippet && (
                      <div className="text-xs text-emerald-600 dark:text-emerald-400 italic mt-1 truncate max-w-md">
                        🎵 {lyricSnippet}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    {totalTrackCount > 0 && (
                      <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                        {totalTrackCount} {totalTrackCount === 1 ? 'track' : 'tracks'}
                      </span>
                    )}

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
                    {/* Action Bar (With Set Category, Stage Font, and 3-dot menu at the far right) */}
                    <div className="flex items-center justify-between gap-2 pt-2">
                      <div className="flex flex-wrap items-center gap-2">
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
                              ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold'
                              : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                          title="Toggle Stage Font Size"
                        >
                          <Type className="w-3.5 h-3.5" />
                          <span>{largeFontMode ? 'Standard Font' : 'Stage Font'}</span>
                        </button>

                        {/* Subtle Category Button next to Stage Font (maintains subtle dashed look regardless of selection) */}
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setCategoryPickerSongId(categoryPickerSongId === song.id ? null : song.id)}
                            className="px-3 py-1.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Set or change song category"
                          >
                            <Tag className="w-3.5 h-3.5 opacity-70" />
                            <span>Category</span>
                            <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
                          </button>

                          {categoryPickerSongId === song.id && (
                            <div className="absolute left-0 top-full mt-1.5 w-48 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1.5 z-40 space-y-0.5">
                              <div className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Set Category
                              </div>
                              <button
                                type="button"
                                onClick={(e) => handleUpdateSongCategory(song, 'Hymn', e)}
                                className="w-full px-3.5 py-1.5 text-left text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center justify-between cursor-pointer"
                              >
                                <span>Hymn</span>
                                {song.category === 'Hymn' && <Check className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleUpdateSongCategory(song, 'Special', e)}
                                className="w-full px-3.5 py-1.5 text-left text-xs font-semibold text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 flex items-center justify-between cursor-pointer"
                              >
                                <span>Special</span>
                                {song.category === 'Special' && <Check className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleUpdateSongCategory(song, 'Contemporary', e)}
                                className="w-full px-3.5 py-1.5 text-left text-xs font-semibold text-cyan-700 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 flex items-center justify-between cursor-pointer"
                              >
                                <span>Contemporary</span>
                                {song.category === 'Contemporary' && <Check className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleUpdateSongCategory(song, 'Choir', e)}
                                className="w-full px-3.5 py-1.5 text-left text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center justify-between cursor-pointer"
                              >
                                <span>Choir</span>
                                {song.category === 'Choir' && <Check className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleUpdateSongCategory(song, 'Tagalog', e)}
                                className="w-full px-3.5 py-1.5 text-left text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center justify-between cursor-pointer"
                              >
                                <span>Tagalog</span>
                                {song.category === 'Tagalog' && <Check className="w-3.5 h-3.5" />}
                              </button>
                              {song.category && (
                                <button
                                  type="button"
                                  onClick={(e) => handleUpdateSongCategory(song, undefined, e)}
                                  className="w-full px-3.5 py-1.5 text-left text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 border-t border-slate-100 dark:border-slate-800 cursor-pointer"
                                >
                                  <span>Clear Category</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 3-Dot Menu Button (Anchored at the far right) */}
                      <div className="relative shrink-0 ml-auto self-start" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setOpenMenuSongId(isMenuOpen ? null : song.id)}
                          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                          title="Song Options"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {/* 3-Dot Dropdown Menu Popover */}
                        {isMenuOpen && (
                          <div className="absolute right-0 top-full mt-1.5 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1.5 z-40 space-y-0.5">
                            <button
                              type="button"
                              onClick={(e) => handleToggleThemeSong(song, e)}
                              className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                              <span>{song.isThemeSong ? 'Remove Theme Song Badge' : 'Mark as Theme Song'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleToggleWelcomeSong(song, e)}
                              className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                              <span>{song.isWelcomeSong ? 'Remove Welcome Song Badge' : 'Mark as Welcome Song'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleToggleClosingSong(song, e)}
                              className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                            >
                              <BookmarkCheck className="w-3.5 h-3.5 text-indigo-500" />
                              <span>{song.isClosingSong ? 'Remove Closing Song Badge' : 'Mark as Closing Song'}</span>
                            </button>

                            <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

                            {/* Quick Category Options in 3-dot menu */}
                            <div className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Category: {song.category || 'None'}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => handleUpdateSongCategory(song, song.category === 'Hymn' ? undefined : 'Hymn', e)}
                              className="w-full px-3.5 py-1.5 text-left text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center justify-between cursor-pointer"
                            >
                              <span className="flex items-center gap-2">
                                <Tag className="w-3 h-3" />
                                <span>Set as Hymn</span>
                              </span>
                              {song.category === 'Hymn' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleUpdateSongCategory(song, song.category === 'Special' ? undefined : 'Special', e)}
                              className="w-full px-3.5 py-1.5 text-left text-xs font-medium text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 flex items-center justify-between cursor-pointer"
                            >
                              <span className="flex items-center gap-2">
                                <Tag className="w-3 h-3" />
                                <span>Set as Special</span>
                              </span>
                              {song.category === 'Special' && <Check className="w-3.5 h-3.5 text-purple-600" />}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleUpdateSongCategory(song, song.category === 'Contemporary' ? undefined : 'Contemporary', e)}
                              className="w-full px-3.5 py-1.5 text-left text-xs font-medium text-cyan-700 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 flex items-center justify-between cursor-pointer"
                            >
                              <span className="flex items-center gap-2">
                                <Tag className="w-3 h-3" />
                                <span>Set as Contemporary</span>
                              </span>
                              {song.category === 'Contemporary' && <Check className="w-3.5 h-3.5 text-cyan-600" />}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleUpdateSongCategory(song, song.category === 'Choir' ? undefined : 'Choir', e)}
                              className="w-full px-3.5 py-1.5 text-left text-xs font-medium text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center justify-between cursor-pointer"
                            >
                              <span className="flex items-center gap-2">
                                <Tag className="w-3 h-3" />
                                <span>Set as Choir</span>
                              </span>
                              {song.category === 'Choir' && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleUpdateSongCategory(song, song.category === 'Tagalog' ? undefined : 'Tagalog', e)}
                              className="w-full px-3.5 py-1.5 text-left text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center justify-between cursor-pointer"
                            >
                              <span className="flex items-center gap-2">
                                <Tag className="w-3 h-3" />
                                <span>Set as Tagalog</span>
                              </span>
                              {song.category === 'Tagalog' && <Check className="w-3.5 h-3.5 text-amber-600" />}
                            </button>

                            <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

                            <button
                              type="button"
                              onClick={(e) => handleStartEditSong(song, e)}
                              className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit Song Details</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuSongId(null);
                                if (confirm(`Remove "${song.title}" from Song Library?`)) {
                                  onDeleteSong(song.id);
                                  setSelectedSongId(null);
                                  onClearInitialSelectedSongId?.();
                                }
                              }}
                              className="w-full px-3.5 py-2 text-left text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete Song</span>
                            </button>
                          </div>
                        )}
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

                    {/* VIDEO / SOUND PLAYER (Placed right after the lyrics with Repeat / Loop button) */}
                    {activeMedia && (
                      <div className="p-4 rounded-2xl bg-slate-900 text-white dark:bg-slate-950 border border-slate-800 shadow-md space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                          <div className="flex items-center space-x-2 min-w-0">
                            <Volume2 className="w-4 h-4 text-sky-400 shrink-0 animate-pulse" />
                            <span className="text-xs font-bold truncate">
                              Playing: {activeMedia.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* BG Play toggle button for background playback when minimized */}
                            <button
                              type="button"
                              onClick={() => setIsBgPlayEnabled(!isBgPlayEnabled)}
                              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                                isBgPlayEnabled
                                  ? 'bg-emerald-500 text-white shadow-xs'
                                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                              }`}
                              title={
                                isBgPlayEnabled
                                  ? 'Background Play ON: Continues playing even when browser/tab is minimized'
                                  : 'Background Play OFF: Click to enable background audio playback'
                              }
                            >
                              <Radio className="w-3.5 h-3.5" />
                              <span className="text-[10px]">{isBgPlayEnabled ? 'BG Play ON' : 'BG Play'}</span>
                            </button>

                            {/* Repeat / Loop toggle button (Only for attached files, not web/youtube links) */}
                            {(activeMedia.type === 'audio' ||
                              activeMedia.type === 'video' ||
                              activeMedia.type === 'file' ||
                              activeMedia.url.startsWith('data:')) && (
                              <button
                                type="button"
                                onClick={() => setIsLooping(!isLooping)}
                                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                                  isLooping
                                    ? 'bg-sky-500 text-white'
                                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                                }`}
                                title={isLooping ? 'Repeat Mode: ON (Looping enabled)' : 'Repeat Mode: OFF (Click to loop)'}
                              >
                                <Repeat className="w-3.5 h-3.5" />
                                <span className="text-[10px]">{isLooping ? 'Repeat ON' : 'Repeat'}</span>
                              </button>
                            )}

                            <button
                              onClick={() => setActiveMedia(null)}
                              className="text-slate-400 hover:text-white p-1 cursor-pointer ml-0.5"
                              title="Close Player"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
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

                          const resolvedUrl = resolveMediaUrl(activeMedia.url);

                          if (activeMedia.type === 'video' || activeMedia.url.startsWith('data:video/')) {
                            return (
                              <video
                                src={resolvedUrl}
                                controls
                                autoPlay
                                loop={isLooping}
                                className="w-full max-h-72 rounded-xl bg-black"
                              />
                            );
                          }

                          if (activeMedia.type === 'audio' || activeMedia.url.startsWith('data:audio/')) {
                            return (
                              <div className="p-2 bg-slate-800/80 rounded-xl">
                                <audio src={resolvedUrl} controls autoPlay loop={isLooping} className="w-full" />
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
                                className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-900 font-bold flex items-center gap-1 shrink-0 hover:bg-white"
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
                                        ? 'bg-slate-100 dark:bg-slate-800 border-slate-900 dark:border-slate-100 ring-1 ring-slate-900 dark:ring-slate-100'
                                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                                    }`}
                                  >
                                    <div className="flex items-center space-x-2.5 min-w-0">
                                      <div className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shrink-0">
                                        {att.type === 'video' ? (
                                          <FileVideo className="w-3.5 h-3.5 text-rose-500" />
                                        ) : att.type === 'audio' ? (
                                          <FileAudio className="w-3.5 h-3.5 text-sky-500" />
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

                                    {/* Delete button only at far right (removed redundant Play button) */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <button
                                        type="button"
                                        onClick={(e) => handleDeleteAttachment(att.id, e)}
                                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                                        title="Delete attachment"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
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
                                      <FileAudio className="w-3.5 h-3.5 text-sky-500" />
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
                                        ? 'bg-slate-100 dark:bg-slate-800 border-slate-900 dark:border-slate-100 ring-1 ring-slate-900 dark:ring-slate-100'
                                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                                    }`}
                                  >
                                    <div className="flex items-center space-x-2.5 min-w-0">
                                      <div className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shrink-0">
                                        {att.type === 'video' ? (
                                          <FileVideo className="w-3.5 h-3.5 text-rose-500" />
                                        ) : att.type === 'audio' ? (
                                          <FileAudio className="w-3.5 h-3.5 text-sky-500" />
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

                                    {/* Delete button only at far right (removed redundant Play button) */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <button
                                        type="button"
                                        onClick={(e) => handleDeleteAttachment(att.id, e)}
                                        className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                                        title="Delete attachment"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
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

                    {/* Centered "Add Attachment" Button at the bottom (Icon + Text without duplicate +) */}
                    <div className="flex justify-center pt-2">
                      <button
                        type="button"
                        onClick={(e) => handleOpenAddAttachment('minus_one', e)}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 transition-all cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                        <span>Add Attachment</span>
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
                  <option value="NEW">Create Brand New Setlist with this song</option>
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
                  className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-xs cursor-pointer"
                >
                  {targetSetlistId === 'NEW' ? 'Create New Setlist' : 'Add to Setlist'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD ATTACHMENT / TRACKS */}
      {isAddingAttachment && selectedSong && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-slate-700 dark:text-slate-300" />
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

              {/* Attachment Title */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Attachment Title
                </label>
                <input
                  type="text"
                  value={attachmentName}
                  onChange={(e) => setAttachmentName(e.target.value)}
                  placeholder={
                    attachmentCategory === 'plus_one'
                      ? 'Vocal Track Name'
                      : 'Track Name'
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
                    placeholder="https://www.youtube.com/watch?v=... or direct audio/video link"
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

                {/* Cloud Upload Progress Bar */}
                {isUploadingCloudMedia && (
                  <div className="mt-2.5 p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-sky-800 dark:text-sky-300 font-semibold">
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
                        <span>{uploadStatusText || 'Uploading to Cloud Media Storage...'}</span>
                      </span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-sky-200 dark:bg-sky-900 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-sky-600 h-full transition-all duration-200 rounded-full"
                        style={{ width: `${Math.max(uploadProgress, 5)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Successfully Attached & Synced Badge */}
                {!isUploadingCloudMedia && attachmentFileName && (
                  <div className="mt-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                    <span className="truncate font-semibold flex items-center gap-1.5">
                      <Cloud className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate">Attached & Cloud-Synced: {attachmentFileName}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setAttachmentLinkOrData('');
                        setAttachmentFileName('');
                      }}
                      className="text-emerald-700 hover:text-rose-600 ml-2 font-bold cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                )}

                <span className="text-[11px] text-slate-400 mt-1 block">
                  Paste any YouTube/audio link or click the paperclip icon to upload tracks (&gt;1MB supported with Universal Cloud Storage).
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddingAttachment(false)}
                  disabled={isUploadingCloudMedia}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploadingCloudMedia || !attachmentLinkOrData.trim()}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isUploadingCloudMedia ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <span>Save Attachment</span>
                  )}
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
                  placeholder="Enter song title"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white font-medium"
                />
              </div>

              {/* Optional Artist / Origin with "Add Artist/Origin" button */}
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
                      placeholder="Enter artist, composer, or hymn origin"
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                      autoFocus
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowArtistInput(true)}
                    className="text-xs font-bold text-slate-700 dark:text-slate-300 hover:underline flex items-center gap-1 cursor-pointer py-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add artist/origin</span>
                  </button>
                )}
              </div>

              {/* Lyrics Field with Expand/Collapse toggle */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Lyrics
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsLyricsExpandedInEditor(!isLyricsExpandedInEditor)}
                    className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer flex items-center gap-1"
                  >
                    {isLyricsExpandedInEditor ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" />
                        <span>Compact box</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" />
                        <span>Expand box</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  rows={isLyricsExpandedInEditor ? 18 : 8}
                  value={editingSong.lyrics || ''}
                  onChange={(e) => setEditingSong({ ...editingSong, lyrics: e.target.value })}
                  placeholder="[Verse 1]&#10;Type lyrics here...&#10;&#10;[Chorus]&#10;..."
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white leading-relaxed resize-y transition-all"
                />
              </div>

              {/* Tag / Category Badges for Song */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
                  Song Badges & Markings
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingSong({
                        ...editingSong,
                        isThemeSong: !editingSong.isThemeSong,
                      })
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                      editingSong.isThemeSong
                        ? 'bg-amber-100 dark:bg-amber-950/90 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Theme Song</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setEditingSong({
                        ...editingSong,
                        isWelcomeSong: !editingSong.isWelcomeSong,
                      })
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                      editingSong.isWelcomeSong
                        ? 'bg-sky-100 dark:bg-sky-950/90 text-sky-900 dark:text-sky-300 border-sky-300 dark:border-sky-700 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                    <span>Welcome Song</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setEditingSong({
                        ...editingSong,
                        isClosingSong: !editingSong.isClosingSong,
                      })
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                      editingSong.isClosingSong
                        ? 'bg-indigo-100 dark:bg-indigo-950/90 text-indigo-900 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <BookmarkCheck className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Closing Song</span>
                  </button>
                </div>
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
                  className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-xs cursor-pointer"
                >
                  Save Song
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Floating Action Button (FAB) - Add Song to Library */}
      <button
        type="button"
        onClick={handleStartCreateSong}
        className="fixed bottom-20 sm:bottom-8 right-5 sm:right-8 z-40 w-14 h-14 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xl hover:shadow-2xl hover:bg-slate-800 dark:hover:bg-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer focus:outline-none focus:ring-4 focus:ring-slate-900/20 dark:focus:ring-white/20"
        title="Add New Song to Library"
        aria-label="Add New Song to Library"
      >
        <Plus className="w-7 h-7 stroke-[2.5]" />
      </button>
    </div>
  );
};
