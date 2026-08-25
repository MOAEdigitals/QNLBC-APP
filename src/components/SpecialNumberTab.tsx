import React, { useState, useRef } from 'react';
import {
  SpecialNumberEntry,
  PracticeGroupEntry,
  PracticePartTrack,
  VocalPartLabel,
  SpecialNumbersSubTab,
  Song,
  Setlist,
  SongAttachment,
} from '../types';
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
  Users,
  Radio,
  Repeat,
  Volume2,
  Paperclip,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
} from 'lucide-react';

interface SpecialNumberTabProps {
  specialNumbers: SpecialNumberEntry[];
  practiceEntries?: PracticeGroupEntry[];
  songs: Song[];
  setlists: Setlist[];
  onSaveSpecialNumber: (entry: SpecialNumberEntry) => void;
  onDeleteSpecialNumber: (id: string) => void;
  onSavePracticeEntry?: (entry: PracticeGroupEntry) => void;
  onDeletePracticeEntry?: (id: string) => void;
  onOpenSongDetail: (songId: string) => void;
  onSaveSong?: (song: Song) => void;
  collapseSignal?: number;
}

const VOCAL_PART_OPTIONS: VocalPartLabel[] = [
  'Soprano',
  'Alto',
  'Tenor',
  'Bass',
  'Baritone',
  'Lead',
  'Harmony',
  'Choir / All',
  'Custom',
];

export const SpecialNumberTab: React.FC<SpecialNumberTabProps> = ({
  specialNumbers,
  practiceEntries = [],
  songs,
  setlists,
  onSaveSpecialNumber,
  onDeleteSpecialNumber,
  onSavePracticeEntry,
  onDeletePracticeEntry,
  onOpenSongDetail,
  onSaveSong,
  collapseSignal,
}) => {
  // Sub-tabs: Schedules (default) or Practice
  const [activeSubTab, setActiveSubTab] = useState<SpecialNumbersSubTab>('schedules');

  // Schedules state
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Partial<SpecialNumberEntry> | null>(null);
  const [scheduleSearchQuery, setScheduleSearchQuery] = useState('');
  const [syncedNotice, setSyncedNotice] = useState(false);

  // Practice state
  const [selectedPracticeId, setSelectedPracticeId] = useState<string | null>(null);
  const [isEditingPractice, setIsEditingPractice] = useState(false);
  const [editingPractice, setEditingPractice] = useState<Partial<PracticeGroupEntry> | null>(null);
  const [practiceSearchQuery, setPracticeSearchQuery] = useState('');

  // Song creation inside Practice session state
  const [isCreatingSongInPractice, setIsCreatingSongInPractice] = useState(false);
  const [newSongArtist, setNewSongArtist] = useState('');
  const [showSongArtistInput, setShowSongArtistInput] = useState(false);

  // Hidden File input helper for paperclip attachments (vocal parts and practice tracks)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFileCallbackRef = useRef<((fileUrl: string, fileName: string) => void) | null>(null);

  const handleTriggerFileUpload = (onFileLoaded: (fileUrl: string, fileName: string) => void) => {
    pendingFileCallbackRef.current = onFileLoaded;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingFileCallbackRef.current) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (pendingFileCallbackRef.current) {
        pendingFileCallbackRef.current(result, file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  // Practice Audio Player state
  const [activePracticeMedia, setActivePracticeMedia] = useState<{
    id: string;
    title: string;
    url: string;
    type: 'audio' | 'video' | 'link' | 'file';
    partLabel?: string;
  } | null>(null);
  const [isLooping, setIsLooping] = useState(false);
  const [isBgPlayEnabled, setIsBgPlayEnabled] = useState(false);

  // Collapse active container if tab icon is tapped
  React.useEffect(() => {
    if (collapseSignal !== undefined && collapseSignal > 0) {
      setSelectedEntryId(null);
      setIsEditingSchedule(false);
      setEditingSchedule(null);
      setSelectedPracticeId(null);
      setIsEditingPractice(false);
      setEditingPractice(null);
      setActivePracticeMedia(null);
    }
  }, [collapseSignal]);

  // Back swipe / popstate listener to collapse container
  React.useEffect(() => {
    const handlePopState = () => {
      if (isEditingSchedule) {
        setIsEditingSchedule(false);
        setEditingSchedule(null);
        return;
      }
      if (isEditingPractice) {
        setIsEditingPractice(false);
        setEditingPractice(null);
        return;
      }
      if (selectedEntryId) {
        setSelectedEntryId(null);
        return;
      }
      if (selectedPracticeId) {
        setSelectedPracticeId(null);
        return;
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isEditingSchedule, isEditingPractice, selectedEntryId, selectedPracticeId]);

  // MediaSession integration for background play
  React.useEffect(() => {
    if (!activePracticeMedia) return;
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: activePracticeMedia.title || 'Practice Track',
        artist: activePracticeMedia.partLabel ? `Part: ${activePracticeMedia.partLabel}` : 'Vocal Rehearsal',
        album: 'Singing Practice & Stems',
      });
      navigator.mediaSession.setActionHandler('play', () => {
        const audioEl = document.querySelector('audio') as HTMLAudioElement | null;
        if (audioEl) audioEl.play().catch(() => {});
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        const audioEl = document.querySelector('audio') as HTMLAudioElement | null;
        if (audioEl) audioEl.pause();
      });
    }
  }, [activePracticeMedia, isBgPlayEnabled]);

  const directoryNames = getAllDirectoryNames();
  const songTitleSuggestions = songs.map((s) => s.title);

  // Sorted: soonest upcoming at top (nearest future/today first), past dates below
  const sortedEntries = sortUpcomingFirst<SpecialNumberEntry>(
    specialNumbers,
    (e: SpecialNumberEntry) => e.scheduledDate
  );

  const filteredScheduleEntries = sortedEntries.filter((item: SpecialNumberEntry) => {
    if (!scheduleSearchQuery.trim()) return true;
    const q = scheduleSearchQuery.toLowerCase();
    return (
      item.performerName.toLowerCase().includes(q) ||
      (item.songTitle && item.songTitle.toLowerCase().includes(q)) ||
      (item.notes && item.notes.toLowerCase().includes(q))
    );
  });

  const soonestEntry = sortedEntries.find((e) => !isPastDate(e.scheduledDate));

  // Compute Vacancies for Schedules
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

  // Compute vacant fellowships or special events
  const vacantEvents = setlists.filter((s) => {
    if (s.type === 'sunday') return false;
    if (isPastDate(s.date)) return false;
    const hasSpecial = specialNumbers.some((sp) => sp.scheduledDate === s.date);
    return !hasSpecial;
  });

  // Practice filtering
  const filteredPracticeEntries = practiceEntries.filter((item) => {
    if (!practiceSearchQuery.trim()) return true;
    const q = practiceSearchQuery.toLowerCase();
    return (
      item.groupName.toLowerCase().includes(q) ||
      item.songTitle.toLowerCase().includes(q) ||
      (item.notes && item.notes.toLowerCase().includes(q)) ||
      (item.assignedEvent && item.assignedEvent.toLowerCase().includes(q)) ||
      item.vocalParts.some(
        (p) =>
          p.assignedUsers.some((u) => u.toLowerCase().includes(q)) ||
          p.partLabel.toLowerCase().includes(q)
      )
    );
  });

  // Helper for YouTube embed
  const getYouTubeEmbedUrl = (url?: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? `https://www.youtube.com/embed/${match[2]}` : null;
  };

  // Schedule Save Handler
  const handleSaveScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchedule || !editingSchedule.performerName?.trim()) return;

    let finalSongTitle = editingSchedule.songTitle?.trim() || '';
    let matchedSongId = editingSchedule.songId;

    if (finalSongTitle) {
      const match = songs.find((s) => s.title.toLowerCase() === finalSongTitle.toLowerCase());
      if (match) {
        matchedSongId = match.id;
      } else {
        finalSongTitle = formatDuplicateTitle(finalSongTitle, songs);
        const newSong = upsertSongFromSpecialNumber(
          finalSongTitle,
          editingSchedule.lyrics || '',
          editingSchedule.minusOneLink || ''
        );
        matchedSongId = newSong.id;
      }
    }

    const entryToSave: SpecialNumberEntry = {
      id: editingSchedule.id || `sp-${Date.now()}`,
      performerName: editingSchedule.performerName.trim(),
      scheduledDate: editingSchedule.scheduledDate || getNextSundayStr(),
      songTitle: finalSongTitle,
      songId: matchedSongId,
      minusOneLink: editingSchedule.minusOneLink?.trim() || '',
      notes: editingSchedule.notes?.trim() || '',
      lyrics: editingSchedule.lyrics?.trim() || '',
      createdAt: editingSchedule.createdAt || new Date().toISOString(),
    };

    onSaveSpecialNumber(entryToSave);
    setIsEditingSchedule(false);
    setEditingSchedule(null);
    setSyncedNotice(true);
    setTimeout(() => setSyncedNotice(false), 3500);
  };

  // Practice Save Handler
  const handleSavePracticeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPractice || !editingPractice.groupName?.trim() || !editingPractice.songTitle?.trim()) return;

    const trimmedTitle = editingPractice.songTitle.trim();
    let effectiveSongId = editingPractice.songId;

    // If user created a new song or typed a song not yet in the library, save it to the Songs library
    const matchedSong = songs.find(
      (s) => s.title.toLowerCase() === trimmedTitle.toLowerCase()
    );

    if (isCreatingSongInPractice || !matchedSong) {
      if (!matchedSong && onSaveSong) {
        const newSong: Song = {
          id: `song-${Date.now()}`,
          title: trimmedTitle,
          artist: newSongArtist.trim() || undefined,
          lyrics: editingPractice.lyrics || '',
          updatedAt: new Date().toISOString(),
        };
        onSaveSong(newSong);
        effectiveSongId = newSong.id;
      } else if (matchedSong) {
        effectiveSongId = matchedSong.id;
      }
    } else if (matchedSong) {
      effectiveSongId = matchedSong.id;
    }

    const entryToSave: PracticeGroupEntry = {
      id: editingPractice.id || `prac-${Date.now()}`,
      groupName: editingPractice.groupName.trim(),
      songTitle: trimmedTitle,
      songId: effectiveSongId,
      targetDate: editingPractice.targetDate || '',
      assignedEvent: editingPractice.assignedEvent?.trim() || '',
      lyrics: editingPractice.lyrics || (matchedSong ? matchedSong.lyrics : '') || '',
      notes: editingPractice.notes?.trim() || '',
      customAttachments: editingPractice.customAttachments || [],
      vocalParts: editingPractice.vocalParts || [],
      createdAt: editingPractice.createdAt || new Date().toISOString(),
    };

    if (onSavePracticeEntry) {
      onSavePracticeEntry(entryToSave);
    }
    // Automatically select and expand the newly created practice session container
    setSelectedPracticeId(entryToSave.id);
    setIsEditingPractice(false);
    setEditingPractice(null);
    setIsCreatingSongInPractice(false);
    setNewSongArtist('');
    setShowSongArtistInput(false);
  };

  // Select song from library for Practice (Title & Lyrics ONLY, NO attachments inherited)
  const handleSelectSongForPractice = (songTitleInput: string) => {
    const matched = songs.find(
      (s) => s.title.toLowerCase() === songTitleInput.trim().toLowerCase()
    );
    if (matched) {
      setEditingPractice((prev) => ({
        ...prev,
        songTitle: matched.title,
        songId: matched.id,
        lyrics: matched.lyrics || '', // Clean slate: title & lyrics only!
      }));
      setIsCreatingSongInPractice(false);
    } else {
      setEditingPractice((prev) => ({
        ...prev,
        songTitle: songTitleInput,
      }));
    }
  };

  // In-place vocal parts handlers (directly modifying group and persisting)
  const handleInPlaceAddVocalPart = (group: PracticeGroupEntry) => {
    const newPart: PracticePartTrack = {
      id: `part-${Date.now()}`,
      partLabel: 'Soprano',
      assignedUsers: [],
      audioUrl: '',
      notes: '',
    };
    const updatedParts = [...(group.vocalParts || []), newPart];
    if (onSavePracticeEntry) {
      onSavePracticeEntry({ ...group, vocalParts: updatedParts });
    }
  };

  const handleInPlaceUpdateVocalPart = (
    group: PracticeGroupEntry,
    partIndex: number,
    patch: Partial<PracticePartTrack>
  ) => {
    const updatedParts = [...(group.vocalParts || [])];
    updatedParts[partIndex] = { ...updatedParts[partIndex], ...patch };
    if (onSavePracticeEntry) {
      onSavePracticeEntry({ ...group, vocalParts: updatedParts });
    }
  };

  const handleInPlaceRemoveVocalPart = (group: PracticeGroupEntry, partIndex: number) => {
    const updatedParts = (group.vocalParts || []).filter((_, i) => i !== partIndex);
    if (onSavePracticeEntry) {
      onSavePracticeEntry({ ...group, vocalParts: updatedParts });
    }
  };

  // In-place practice attachments handlers
  const handleInPlaceAddTrack = (group: PracticeGroupEntry) => {
    const newTrack: SongAttachment = {
      id: `att-${Date.now()}`,
      name: 'Minus One Track',
      url: '',
      type: 'link',
      category: 'minus_one',
      uploadedAt: new Date().toISOString(),
    };
    const updatedTracks = [...(group.customAttachments || []), newTrack];
    if (onSavePracticeEntry) {
      onSavePracticeEntry({ ...group, customAttachments: updatedTracks });
    }
  };

  const handleInPlaceUpdateTrack = (
    group: PracticeGroupEntry,
    trackIndex: number,
    patch: Partial<SongAttachment>
  ) => {
    const updatedTracks = [...(group.customAttachments || [])];
    updatedTracks[trackIndex] = { ...updatedTracks[trackIndex], ...patch };
    if (onSavePracticeEntry) {
      onSavePracticeEntry({ ...group, customAttachments: updatedTracks });
    }
  };

  const handleInPlaceRemoveTrack = (group: PracticeGroupEntry, trackIndex: number) => {
    const updatedTracks = (group.customAttachments || []).filter((_, i) => i !== trackIndex);
    if (onSavePracticeEntry) {
      onSavePracticeEntry({ ...group, customAttachments: updatedTracks });
    }
  };

  // Manage Practice Attachments in Modal
  const handleAddPracticeAttachment = () => {
    if (!editingPractice) return;
    const newAtt: SongAttachment = {
      id: `att-${Date.now()}`,
      name: 'Minus One Track',
      url: '',
      type: 'link',
      category: 'minus_one',
      uploadedAt: new Date().toISOString(),
    };
    setEditingPractice({
      ...editingPractice,
      customAttachments: [...(editingPractice.customAttachments || []), newAtt],
    });
  };

  const handleUpdatePracticeAttachment = (idx: number, patch: Partial<SongAttachment>) => {
    if (!editingPractice || !editingPractice.customAttachments) return;
    const updated = [...editingPractice.customAttachments];
    updated[idx] = { ...updated[idx], ...patch };
    setEditingPractice({ ...editingPractice, customAttachments: updated });
  };

  const handleRemovePracticeAttachment = (idx: number) => {
    if (!editingPractice || !editingPractice.customAttachments) return;
    const updated = editingPractice.customAttachments.filter((_, i) => i !== idx);
    setEditingPractice({ ...editingPractice, customAttachments: updated });
  };

  // Manage Practice Vocal Parts in Modal
  const handleAddVocalPart = () => {
    if (!editingPractice) return;
    const newPart: PracticePartTrack = {
      id: `part-${Date.now()}`,
      partLabel: 'Soprano',
      assignedUsers: [],
      audioUrl: '',
      notes: '',
    };
    setEditingPractice({
      ...editingPractice,
      vocalParts: [...(editingPractice.vocalParts || []), newPart],
    });
  };

  const handleUpdateVocalPart = (idx: number, patch: Partial<PracticePartTrack>) => {
    if (!editingPractice || !editingPractice.vocalParts) return;
    const updated = [...editingPractice.vocalParts];
    updated[idx] = { ...updated[idx], ...patch };
    setEditingPractice({ ...editingPractice, vocalParts: updated });
  };

  const handleRemoveVocalPart = (idx: number) => {
    if (!editingPractice || !editingPractice.vocalParts) return;
    const updated = editingPractice.vocalParts.filter((_, i) => i !== idx);
    setEditingPractice({ ...editingPractice, vocalParts: updated });
  };

  return (
    <div className="space-y-5">
      {/* Top Main Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Mic2 className="w-5 h-5 text-slate-800 dark:text-slate-200" />
            <span>Special Song Numbers & Practice</span>
          </h2>
        </div>

        {activeSubTab === 'schedules' ? (
          <button
            onClick={() => {
              setEditingSchedule({
                id: `sp-${Date.now()}`,
                performerName: '',
                scheduledDate: getNextSundayStr(),
                songTitle: '',
                minusOneLink: '',
                notes: '',
                lyrics: '',
                createdAt: new Date().toISOString(),
              });
              setIsEditingSchedule(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold hover:bg-slate-800 dark:hover:bg-white transition-all shadow-xs shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Special Song Number</span>
          </button>
        ) : (
          <button
            onClick={() => {
              setIsCreatingSongInPractice(false);
              setNewSongArtist('');
              setShowSongArtistInput(false);
              setEditingPractice({
                id: `prac-${Date.now()}`,
                groupName: '',
                songTitle: '',
                assignedEvent: 'Sunday Service',
                lyrics: '',
                notes: '',
                customAttachments: [],
                vocalParts: [],
                createdAt: new Date().toISOString(),
              });
              setIsEditingPractice(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold hover:bg-slate-800 dark:hover:bg-white transition-all shadow-xs shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Practice Session</span>
          </button>
        )}
      </div>

      {/* Sub-Tabs: Schedules (default) & Practice */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('schedules')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer ${
            activeSubTab === 'schedules'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Schedules</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeSubTab === 'schedules'
                ? 'bg-white/20 text-white dark:bg-black/20 dark:text-slate-900'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            {specialNumbers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('practice')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer ${
            activeSubTab === 'practice'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Practice</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeSubTab === 'practice'
                ? 'bg-white/20 text-white dark:bg-black/20 dark:text-slate-900'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            {practiceEntries.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SCHEDULES SUB-TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'schedules' && (
        <div className="space-y-4">
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
                        setEditingSchedule({
                          id: `sp-${Date.now()}`,
                          performerName: '',
                          scheduledDate: dateStr,
                          songTitle: '',
                          minusOneLink: '',
                          notes: '',
                          lyrics: '',
                          createdAt: new Date().toISOString(),
                        });
                        setIsEditingSchedule(true);
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
                  setEditingSchedule({
                    id: `sp-${Date.now()}`,
                    performerName: '',
                    scheduledDate: vacantEvents[0].date,
                    songTitle: '',
                    notes: `Special number for ${vacantEvents[0].title || 'Fellowship'}`,
                    createdAt: new Date().toISOString(),
                  });
                  setIsEditingSchedule(true);
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
              value={scheduleSearchQuery}
              onChange={(e) => setScheduleSearchQuery(e.target.value)}
              placeholder="Search performer, song title, or notes..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-colors"
            />
          </div>

          {/* All Song Numbers Header List */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                All song numbers ({filteredScheduleEntries.length})
              </h3>
            </div>

            {filteredScheduleEntries.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                No special song numbers scheduled. Click "Schedule Special Song Number" to add one!
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredScheduleEntries.map((item) => {
                  const isPast = isPastDate(item.scheduledDate);
                  const today = isToday(item.scheduledDate);
                  const isSelected = selectedEntryId === item.id;
                  const isSoonest = soonestEntry?.id === item.id;
                  const matchedSong = item.songId ? songs.find((s) => s.id === item.songId) : null;

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
                              {formatDateStr(item.scheduledDate, { shortMonth: true }).split(' ')[0]}
                            </span>
                            <span className="text-base font-black leading-none mt-0.5">
                              {item.scheduledDate.split('-')[2]}
                            </span>
                          </div>

                          <div className="min-w-0">
                            {/* Performer Name */}
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

                            {/* Song title or RED 'No Song Yet' badge */}
                            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5 flex items-center gap-1.5">
                              {item.songTitle ? (
                                <span className="italic font-medium">Song: {item.songTitle}</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/80">
                                  No song yet (TBD)
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                              <span>{formatDateStr(item.scheduledDate, { showDayOfWeek: true })}</span>
                              {item.minusOneLink && <span>• Minus-one available</span>}
                            </div>
                          </div>
                        </div>

                        {/* Far Right Action Buttons */}
                        <div
                          className="flex items-center space-x-1.5 text-slate-400 shrink-0 ml-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSchedule(item);
                              setIsEditingSchedule(true);
                            }}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                            title="Edit Special Number"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Remove special song number for ${item.performerName}?`)) {
                                onDeleteSpecialNumber(item.id);
                                if (selectedEntryId === item.id) setSelectedEntryId(null);
                              }
                            }}
                            className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                            title="Delete Special Number"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

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
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Rehearsal Notes */}
                            {item.notes && (
                              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
                                <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                                  Rehearsal / Practice Notes:
                                </span>
                                <p className="text-slate-600 dark:text-slate-400">{item.notes}</p>
                              </div>
                            )}

                            {/* Minus-One Link & Song Library Deep Link */}
                            <div className="space-y-2">
                              {item.minusOneLink && (
                                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between">
                                  <div>
                                    <span className="font-bold text-slate-700 dark:text-slate-300 block">
                                      Minus-One Accompaniment
                                    </span>
                                    <span className="text-[11px] text-slate-500 truncate block max-w-xs">
                                      {item.minusOneLink}
                                    </span>
                                  </div>
                                  <a
                                    href={item.minusOneLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-3 py-1.5 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold flex items-center gap-1 shrink-0"
                                  >
                                    <Play className="w-3 h-3" />
                                    <span>Play Track</span>
                                  </a>
                                </div>
                              )}

                              {matchedSong && (
                                <button
                                  type="button"
                                  onClick={() => onOpenSongDetail(matchedSong.id)}
                                  className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between cursor-pointer transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <Music className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                                    <span>View "{matchedSong.title}" in Song Library</span>
                                  </div>
                                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Performance Lyrics / Text */}
                          {(item.lyrics || matchedSong?.lyrics) && (
                            <div className="space-y-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                                Performance Lyrics
                              </span>
                              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap max-h-60 overflow-y-auto">
                                {item.lyrics || matchedSong?.lyrics}
                              </div>
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* PRACTICE SUB-TAB (Singing Groups, Vocal Parts & Practice Stems) */}
      {/* ========================================================================= */}
      {activeSubTab === 'practice' && (
        <div className="space-y-4">
          {/* Active Practice Media Player */}
          {activePracticeMedia && (
            <div className="p-4 rounded-2xl bg-slate-900 text-white dark:bg-slate-950 border border-slate-800 shadow-md space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center space-x-2 min-w-0">
                  <Volume2 className="w-4 h-4 text-sky-400 shrink-0 animate-pulse" />
                  <span className="text-xs font-bold truncate">
                    Rehearsal Track: {activePracticeMedia.title}
                    {activePracticeMedia.partLabel && ` (${activePracticeMedia.partLabel})`}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* BG Play toggle */}
                  <button
                    type="button"
                    onClick={() => setIsBgPlayEnabled(!isBgPlayEnabled)}
                    className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                      isBgPlayEnabled
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                    }`}
                    title={
                      isBgPlayEnabled
                        ? 'Background Play ON: Keeps playing even when minimized'
                        : 'Background Play OFF: Click to enable background audio'
                    }
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span className="text-[10px]">{isBgPlayEnabled ? 'BG Play ON' : 'BG Play'}</span>
                  </button>

                  {/* Repeat toggle for attached files */}
                  {(activePracticeMedia.type === 'audio' ||
                    activePracticeMedia.type === 'video' ||
                    activePracticeMedia.type === 'file' ||
                    activePracticeMedia.url.startsWith('data:')) && (
                    <button
                      type="button"
                      onClick={() => setIsLooping(!isLooping)}
                      className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                        isLooping
                          ? 'bg-sky-500 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                      }`}
                      title={isLooping ? 'Repeat ON (Looping enabled)' : 'Repeat OFF'}
                    >
                      <Repeat className="w-3.5 h-3.5" />
                      <span className="text-[10px]">{isLooping ? 'Repeat ON' : 'Repeat'}</span>
                    </button>
                  )}

                  <button
                    onClick={() => setActivePracticeMedia(null)}
                    className="text-slate-400 hover:text-white p-1 cursor-pointer"
                    title="Close Player"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* YouTube or Audio Player */}
              {(() => {
                const ytEmbed = getYouTubeEmbedUrl(activePracticeMedia.url);
                if (ytEmbed) {
                  return (
                    <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
                      <iframe
                        src={ytEmbed}
                        title={activePracticeMedia.title}
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  );
                }

                if (
                  activePracticeMedia.type === 'audio' ||
                  activePracticeMedia.url.startsWith('data:audio/')
                ) {
                  return (
                    <div className="p-2 bg-slate-800/80 rounded-xl">
                      <audio src={activePracticeMedia.url} controls autoPlay loop={isLooping} className="w-full" />
                    </div>
                  );
                }

                if (
                  activePracticeMedia.type === 'video' ||
                  activePracticeMedia.url.startsWith('data:video/')
                ) {
                  return (
                    <video
                      src={activePracticeMedia.url}
                      controls
                      autoPlay
                      loop={isLooping}
                      className="w-full max-h-64 rounded-xl bg-black"
                    />
                  );
                }

                return (
                  <div className="p-3 rounded-xl bg-slate-800/80 flex items-center justify-between text-xs">
                    <span className="truncate pr-2">{activePracticeMedia.url}</span>
                    <a
                      href={activePracticeMedia.url}
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

          {/* Search Practice Groups */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={practiceSearchQuery}
              onChange={(e) => setPracticeSearchQuery(e.target.value)}
              placeholder="Search singing group, song, vocal part, or singer name..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-colors"
            />
          </div>

          {/* Practice Groups List */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Singing Groups & Practice Sessions ({filteredPracticeEntries.length})
              </h3>
            </div>

            {filteredPracticeEntries.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                No practice groups created yet. Click "New Practice Session" to organize choir or ensemble rehearsals with vocal stems.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredPracticeEntries.map((group) => {
                  const isSelected = selectedPracticeId === group.id;

                  return (
                    <div
                      key={group.id}
                      onClick={() => setSelectedPracticeId(isSelected ? null : group.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-slate-900 dark:border-slate-100 ring-2 ring-slate-900 dark:ring-slate-100 bg-white dark:bg-slate-900 shadow-md'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-400'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3.5 min-w-0">
                          <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 border bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                            <Users className="w-5 h-5" />
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-base font-black text-slate-900 dark:text-white truncate">
                                {group.groupName}
                              </h4>
                              {group.assignedEvent && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  {group.assignedEvent}
                                </span>
                              )}
                            </div>

                            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5 flex items-center gap-1.5">
                              <span className="italic font-medium">Song: {group.songTitle}</span>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                              {group.assignedEvent && (
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  Event: {group.assignedEvent}
                                </span>
                              )}
                              <span>• {group.vocalParts?.length || 0} vocal parts</span>
                              <span>• {group.customAttachments?.length || 0} tracks</span>
                            </div>
                          </div>
                        </div>

                        {/* Far Right Actions */}
                        <div
                          className="flex items-center space-x-1.5 text-slate-400 shrink-0 ml-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setIsCreatingSongInPractice(false);
                              setNewSongArtist('');
                              setShowSongArtistInput(false);
                              setEditingPractice(group);
                              setIsEditingPractice(true);
                            }}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                            title="Edit Practice Session"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Remove practice group "${group.groupName}"?`)) {
                                if (onDeletePracticeEntry) onDeletePracticeEntry(group.id);
                                if (selectedPracticeId === group.id) setSelectedPracticeId(null);
                              }
                            }}
                            className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                            title="Delete Practice Group"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          <div className="p-1 text-slate-400">
                            {isSelected ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </div>
                      </div>

                      {/* IN-PLACE EXPANDED PRACTICE DETAILS */}
                      {isSelected && (
                        <div
                          className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-5 cursor-default"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Vocal Parts Section (Soprano, Alto, Tenor, Bass, etc.) */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
                                <span>Vocal Parts & Assigned Members</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleInPlaceAddVocalPart(group)}
                                className="px-3 py-1 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add Vocal Part</span>
                              </button>
                            </div>

                            {(!group.vocalParts || group.vocalParts.length === 0) ? (
                              <div className="p-3 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500">
                                No vocal parts added yet. Click <span className="font-semibold text-slate-800 dark:text-slate-200">"Add Vocal Part"</span> to assign parts (Soprano, Alto, Tenor, Bass) and attach vocal audio stems.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 gap-2.5">
                                {group.vocalParts.map((part, pIdx) => (
                                  <div
                                    key={part.id}
                                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5"
                                  >
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                      {/* Part Dropdown */}
                                      <div className="w-full sm:w-1/3">
                                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                                          Part
                                        </label>
                                        <select
                                          value={part.partLabel}
                                          onChange={(e) =>
                                            handleInPlaceUpdateVocalPart(group, pIdx, {
                                              partLabel: e.target.value as VocalPartLabel,
                                            })
                                          }
                                          className="w-full p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                                        >
                                          {VOCAL_PART_OPTIONS.map((opt) => (
                                            <option key={opt} value={opt}>
                                              {opt}
                                            </option>
                                          ))}
                                        </select>
                                      </div>

                                      {/* Assigned Member */}
                                      <div className="w-full sm:w-2/3">
                                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                                          Assigned Member(s)
                                        </label>
                                        <input
                                          type="text"
                                          value={(part.assignedUsers || []).join(', ')}
                                          onChange={(e) =>
                                            handleInPlaceUpdateVocalPart(group, pIdx, {
                                              assignedUsers: e.target.value
                                                .split(',')
                                                .map((s) => s.trim())
                                                .filter(Boolean),
                                            })
                                          }
                                          placeholder="e.g. Sister Grace, Sister Hannah"
                                          className="w-full p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium"
                                        />
                                      </div>

                                      {/* Delete Part Button */}
                                      <div className="flex items-center justify-end sm:pt-4">
                                        <button
                                          type="button"
                                          onClick={() => handleInPlaceRemoveVocalPart(group, pIdx)}
                                          className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                                          title="Remove vocal part"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Link / Attachment Field with Paperclip at the end */}
                                    <div>
                                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                                        Part Stem / Vocal Audio Link or Attachment
                                      </label>
                                      <div className="flex items-center gap-2">
                                        <div className="relative flex-1">
                                          <input
                                            type="text"
                                            value={part.audioUrl || ''}
                                            onChange={(e) =>
                                              handleInPlaceUpdateVocalPart(group, pIdx, {
                                                audioUrl: e.target.value,
                                              })
                                            }
                                            placeholder="Paste link or click paperclip to attach file..."
                                            className="w-full pl-3 pr-10 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                                          />
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleTriggerFileUpload((url) =>
                                                handleInPlaceUpdateVocalPart(group, pIdx, {
                                                  audioUrl: url,
                                                })
                                              )
                                            }
                                            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                                            title="Attach Audio File from Device"
                                          >
                                            <Paperclip className="w-4 h-4" />
                                          </button>
                                        </div>

                                        {part.audioUrl && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setActivePracticeMedia({
                                                id: part.id,
                                                title: `${group.songTitle} - ${part.partLabel} Stem`,
                                                url: part.audioUrl!,
                                                type: 'audio',
                                                partLabel: part.partLabel,
                                              })
                                            }
                                            className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs transition-colors"
                                          >
                                            <Play className="w-3.5 h-3.5" />
                                            <span>Play Stem</span>
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Specific Practice Attachments (Plus-Ones, Minus-Ones, Links) */}
                          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                                <Paperclip className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
                                <span>Rehearsal Tracks & Attachments (Plus-One / Minus-One)</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleInPlaceAddTrack(group)}
                                className="px-3 py-1 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add Track</span>
                              </button>
                            </div>

                            {(!group.customAttachments || group.customAttachments.length === 0) ? (
                              <div className="p-3 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500">
                                No tracks added yet. Click <span className="font-semibold text-slate-800 dark:text-slate-200">"Add Track"</span> to attach plus-one vocals or minus-one backing tracks.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 gap-2.5">
                                {group.customAttachments.map((att, aIdx) => (
                                  <div
                                    key={att.id}
                                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2"
                                  >
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                      <input
                                        type="text"
                                        value={att.name}
                                        onChange={(e) =>
                                          handleInPlaceUpdateTrack(group, aIdx, {
                                            name: e.target.value,
                                          })
                                        }
                                        placeholder="Track Name (e.g. Minus-One Backing Track)"
                                        className="w-full sm:w-1/3 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                                      />

                                      <select
                                        value={att.category || 'minus_one'}
                                        onChange={(e) =>
                                          handleInPlaceUpdateTrack(group, aIdx, {
                                            category: e.target.value as 'plus_one' | 'minus_one',
                                          })
                                        }
                                        className="w-full sm:w-1/4 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                                      >
                                        <option value="minus_one">Minus One (-1)</option>
                                        <option value="plus_one">Plus One (+1)</option>
                                      </select>

                                      <div className="relative flex-1">
                                        <input
                                          type="text"
                                          value={att.url}
                                          onChange={(e) =>
                                            handleInPlaceUpdateTrack(group, aIdx, {
                                              url: e.target.value,
                                            })
                                          }
                                          placeholder="Paste link or attach file..."
                                          className="w-full pl-3 pr-10 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleTriggerFileUpload((url) =>
                                              handleInPlaceUpdateTrack(group, aIdx, {
                                                url: url,
                                              })
                                            )
                                          }
                                          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                                          title="Attach Audio File from Device"
                                        >
                                          <Paperclip className="w-4 h-4" />
                                        </button>
                                      </div>

                                      <div className="flex items-center gap-1 justify-end shrink-0">
                                        {att.url && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setActivePracticeMedia({
                                                id: att.id,
                                                title: att.name,
                                                url: att.url,
                                                type:
                                                  att.type === 'audio' || att.type === 'video'
                                                    ? att.type
                                                    : 'link',
                                              })
                                            }
                                            className="px-2.5 py-2 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold text-xs flex items-center gap-1 cursor-pointer hover:bg-slate-800 transition-colors shadow-xs"
                                          >
                                            <Play className="w-3.5 h-3.5" />
                                            <span>Play</span>
                                          </button>
                                        )}

                                        <button
                                          type="button"
                                          onClick={() => handleInPlaceRemoveTrack(group, aIdx)}
                                          className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                                          title="Remove track"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Practice Rehearsal Lyrics */}
                          {group.lyrics && (
                            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                                Rehearsal Lyrics
                              </span>
                              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap max-h-60 overflow-y-auto">
                                {group.lyrics}
                              </div>
                            </div>
                          )}

                          {/* Rehearsal Instructions / Notes (In-Place in Container) */}
                          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-slate-500" />
                              <span>Rehearsal Instructions / Notes</span>
                            </span>
                            <textarea
                              rows={2}
                              value={group.notes || ''}
                              onChange={(e) => {
                                if (onSavePracticeEntry) {
                                  onSavePracticeEntry({ ...group, notes: e.target.value });
                                }
                              }}
                              placeholder="Add rehearsal instructions, vocal guidance, or practice schedule notes..."
                              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SCHEDULE MODAL (Create / Edit Special Number) */}
      {/* ========================================================================= */}
      {isEditingSchedule && editingSchedule && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-4">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Mic2 className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                <span>
                  {editingSchedule.id && specialNumbers.some((s) => s.id === editingSchedule.id)
                    ? 'Edit Special Song Number'
                    : 'Schedule Special Song Number'}
                </span>
              </h3>
              <button
                onClick={() => setIsEditingSchedule(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveScheduleSubmit} className="p-4 sm:p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Singer / Performer Name(s) *
                </label>
                <div className="rounded-xl border border-slate-300 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800">
                  <AutofillInput
                    value={editingSchedule.performerName || ''}
                    onChange={(val) => setEditingSchedule({ ...editingSchedule, performerName: val })}
                    suggestions={directoryNames}
                    placeholder="e.g. Bro. John Doe / Sis. Maria / Choir Ensemble"
                    inputClassName="p-1.5 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Scheduled Service Date *
                </label>
                <input
                  type="date"
                  required
                  value={editingSchedule.scheduledDate || getNextSundayStr()}
                  onChange={(e) => setEditingSchedule({ ...editingSchedule, scheduledDate: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Song Title (Optional / Autocomplete from library)
                </label>
                <div className="rounded-xl border border-slate-300 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800">
                  <AutofillInput
                    value={editingSchedule.songTitle || ''}
                    onChange={(val) => {
                      const matched = songs.find(
                        (s) => s.title.toLowerCase() === val.trim().toLowerCase()
                      );
                      setEditingSchedule({
                        ...editingSchedule,
                        songTitle: val,
                        songId: matched ? matched.id : editingSchedule.songId,
                        lyrics: matched?.lyrics || editingSchedule.lyrics,
                        minusOneLink: matched?.minusOneLink || editingSchedule.minusOneLink,
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
                  value={editingSchedule.minusOneLink || ''}
                  onChange={(e) => setEditingSchedule({ ...editingSchedule, minusOneLink: e.target.value })}
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
                  value={editingSchedule.notes || ''}
                  onChange={(e) => setEditingSchedule({ ...editingSchedule, notes: e.target.value })}
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
                  value={editingSchedule.lyrics || ''}
                  onChange={(e) => setEditingSchedule({ ...editingSchedule, lyrics: e.target.value })}
                  placeholder="Paste lyrics or stanzas here..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditingSchedule(false)}
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

      {/* ========================================================================= */}
      {/* PRACTICE MODAL (Create / Edit Singing Group Practice) */}
      {/* ========================================================================= */}
      {isEditingPractice && editingPractice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-4">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                <span>
                  {editingPractice.id && practiceEntries.some((p) => p.id === editingPractice.id)
                    ? 'Edit Practice Session & Vocal Stems'
                    : 'New Practice Session & Vocal Stems'}
                </span>
              </h3>
              <button
                onClick={() => setIsEditingPractice(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePracticeSubmit} className="p-4 sm:p-5 space-y-4 max-h-[82vh] overflow-y-auto">
              {/* 1. SINGER / GROUP NAME */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Singer / Group Name *
                </label>
                <div className="rounded-xl border border-slate-300 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800">
                  <AutofillInput
                    value={editingPractice.groupName || ''}
                    onChange={(val) => setEditingPractice({ ...editingPractice, groupName: val })}
                    suggestions={directoryNames}
                    placeholder="e.g. Sunday Choir, Sis. Sarah, Youth Trio, Men's Ensemble"
                    inputClassName="p-2 text-sm font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* 2. TARGET EVENT / OCCASION (OPTIONAL) */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Target Event / Occasion (Optional)
                </label>
                <input
                  type="text"
                  value={editingPractice.assignedEvent !== undefined ? editingPractice.assignedEvent : 'Sunday Service'}
                  onChange={(e) => setEditingPractice({ ...editingPractice, assignedEvent: e.target.value })}
                  placeholder="e.g. Sunday Service, Youth Fellowship"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white"
                />
              </div>

              {/* 3. SONG SELECTION OR CREATE SONG */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                {!isCreatingSongInPractice ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Search Song from Library *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingSongInPractice(true);
                          setEditingPractice({
                            ...editingPractice,
                            songId: undefined,
                          });
                        }}
                        className="text-xs font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create Song</span>
                      </button>
                    </div>

                    <div className="rounded-xl border border-slate-300 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800">
                      <AutofillInput
                        value={editingPractice.songTitle || ''}
                        onChange={(val) => {
                          if (!val.trim()) {
                            setEditingPractice({
                              ...editingPractice,
                              songTitle: '',
                              songId: undefined,
                              lyrics: '',
                            });
                          } else {
                            handleSelectSongForPractice(val);
                          }
                        }}
                        suggestions={songTitleSuggestions}
                        songs={songs}
                        placeholder="Type to search song title from library (autofill)..."
                        inputClassName="p-2 text-sm font-semibold text-slate-900 dark:text-white"
                      />
                    </div>

                    {editingPractice.songTitle && editingPractice.songId ? (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <div className="min-w-0 pr-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                            Selected: {editingPractice.songTitle}
                          </span>
                          {editingPractice.lyrics && (
                            <span className="text-[11px] text-slate-500 block truncate">
                              {editingPractice.lyrics.slice(0, 70)}...
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPractice({
                              ...editingPractice,
                              songTitle: '',
                              songId: undefined,
                              lyrics: '',
                            });
                          }}
                          className="text-xs text-rose-500 hover:text-rose-600 font-semibold px-2 py-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-[11px] text-slate-500 px-0.5">
                        <span>Select a song from library or create a new one.</span>
                        <button
                          type="button"
                          onClick={() => setIsCreatingSongInPractice(true)}
                          className="underline hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer font-medium"
                        >
                          Song not in library? Click Create Song
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Inline "Create Song" matching Add Song from Songs Tab */
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Music className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
                        <span>Create New Song (Adds to Songs tab & Practice)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsCreatingSongInPractice(false)}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer underline"
                      >
                        Search Library Instead
                      </button>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                        Song Title *
                      </label>
                      <input
                        type="text"
                        required
                        value={editingPractice.songTitle || ''}
                        onChange={(e) => setEditingPractice({ ...editingPractice, songTitle: e.target.value })}
                        placeholder="Song Title..."
                        className="w-full p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                      />
                    </div>

                    {!showSongArtistInput ? (
                      <button
                        type="button"
                        onClick={() => setShowSongArtistInput(true)}
                        className="text-xs text-sky-600 hover:text-sky-700 dark:text-sky-400 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Songwriter / Artist (Optional)</span>
                      </button>
                    ) : (
                      <div>
                        <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                          Songwriter / Artist (Optional)
                        </label>
                        <input
                          type="text"
                          value={newSongArtist}
                          onChange={(e) => setNewSongArtist(e.target.value)}
                          placeholder="e.g. Gary Valenciano, Hillsong, Don Moen"
                          className="w-full p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400 mb-1">
                        Lyrics *
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={editingPractice.lyrics || ''}
                        onChange={(e) => setEditingPractice({ ...editingPractice, lyrics: e.target.value })}
                        placeholder="Paste lyrics or stanzas here..."
                        className="w-full p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingPractice(false);
                    setIsCreatingSongInPractice(false);
                  }}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white text-white shadow-xs cursor-pointer"
                >
                  Save Practice Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hidden File Input for Paperclip Audio / Track Uploads */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept="audio/*,video/*"
        className="hidden"
      />
    </div>
  );
};
