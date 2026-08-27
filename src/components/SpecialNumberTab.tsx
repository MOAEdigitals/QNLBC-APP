import React, { useState, useRef, useEffect } from 'react';
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
import {
  saveAudioToStorage,
  getAudioFromStorage,
  deleteAudioFromStorage,
} from '../utils/audioStorage';
import {
  resolveMediaUrl,
  getYouTubeEmbedUrl,
  getGoogleDriveEmbedUrl,
} from '../utils/mediaUtils';
import { AutofillInput } from './AutofillInput';
import { InlinePracticeAudioPlayer } from './InlinePracticeAudioPlayer';
import { PracticeAudioTrackRow } from './PracticeAudioTrackRow';
import {
  Mic2,
  Mic,
  Square,
  Disc,
  Plus,
  Music,
  ExternalLink,
  Calendar,
  Sparkles,
  Trash2,
  Edit3,
  Pencil,
  X,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Rewind,
  FileText,
  Check,
  CheckCircle,
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
  FileAudio,
  FileVideo,
  FileImage,
  Link2,
  Copy,
  MoreVertical,
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

// Debounced Rehearsal Instructions / Notes Input to prevent storage thrashing and crash
const PracticeGroupNotesInput: React.FC<{
  group: PracticeGroupEntry;
  onSavePracticeEntry?: (entry: PracticeGroupEntry) => void;
}> = ({ group, onSavePracticeEntry }) => {
  const [localNotes, setLocalNotes] = useState(group.notes || '');
  const timeoutRef = useRef<any>(null);

  useEffect(() => {
    setLocalNotes(group.notes || '');
  }, [group.notes]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalNotes(val);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (onSavePracticeEntry && val !== (group.notes || '')) {
        onSavePracticeEntry({ ...group, notes: val });
      }
    }, 800);
  };

  const handleBlur = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (onSavePracticeEntry && localNotes !== (group.notes || '')) {
      onSavePracticeEntry({ ...group, notes: localNotes });
    }
  };

  return (
    <textarea
      rows={3}
      value={localNotes}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="Add rehearsal instructions, vocal guidance, or practice schedule notes..."
      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors"
    />
  );
};

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

  // Song artist input inside Practice session state
  const [newSongArtist, setNewSongArtist] = useState('');
  const [showSongArtistInput, setShowSongArtistInput] = useState(false);

  // Modal 1: Add/Edit Track & Attachment Modal (Image 2 style)
  const [isAddingTrackModal, setIsAddingTrackModal] = useState(false);
  const [trackModalGroup, setTrackModalGroup] = useState<PracticeGroupEntry | null>(null);
  const [editingTrackIndex, setEditingTrackIndex] = useState<number | null>(null);
  const [trackCategory, setTrackCategory] = useState<'plus_one' | 'minus_one'>('minus_one');
  const [trackTitle, setTrackTitle] = useState('');
  const [trackUrlOrData, setTrackUrlOrData] = useState('');
  const [trackFileName, setTrackFileName] = useState('');
  const [trackType, setTrackType] = useState<'link' | 'audio' | 'video' | 'file'>('link');

  // Modal 2: Add/Edit Vocal Part Modal
  const [isAddingVocalPartModal, setIsAddingVocalPartModal] = useState(false);
  const [vocalPartModalGroup, setVocalPartModalGroup] = useState<PracticeGroupEntry | null>(null);
  const [editingVocalPartIndex, setEditingVocalPartIndex] = useState<number | null>(null);
  const [vocalPartLabel, setVocalPartLabel] = useState<VocalPartLabel>('Soprano');
  const [vocalPartCustomLabel, setVocalPartCustomLabel] = useState('');
  const [vocalPartAssignedUsers, setVocalPartAssignedUsers] = useState('');
  const [vocalPartAudioUrl, setVocalPartAudioUrl] = useState('');
  const [vocalPartFileName, setVocalPartFileName] = useState('');
  const [vocalPartAudioInputMode, setVocalPartAudioInputMode] = useState<'record' | 'attach'>('record');

  // Direct Audio Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  // Hidden File input helper for paperclip attachments (vocal parts and practice tracks)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFileCallbackRef = useRef<((fileUrl: string, fileName: string, fileType: 'audio' | 'video' | 'file') => void) | null>(null);

  const handleTriggerFileUpload = (onFileLoaded: (fileUrl: string, fileName: string, fileType: 'audio' | 'video' | 'file') => void) => {
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
      const fType: 'audio' | 'video' | 'file' = file.type.startsWith('audio/')
        ? 'audio'
        : file.type.startsWith('video/')
        ? 'video'
        : 'file';
      if (pendingFileCallbackRef.current) {
        pendingFileCallbackRef.current(result, file.name, fType);
      }
    };
    reader.readAsDataURL(file);
  };

  // Practice Video Player state (ONLY for video and video links)
  const [activePracticeMedia, setActivePracticeMedia] = useState<{
    id: string;
    title: string;
    url: string;
    type: 'video' | 'link';
    partLabel?: string;
    groupId?: string;
  } | null>(null);
  const [isLooping, setIsLooping] = useState(false);
  const [isBgPlayEnabled, setIsBgPlayEnabled] = useState(false);
  const [isMediaPlaying, setIsMediaPlaying] = useState(true);
  const practiceMediaRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(null);

  // Global active playing track ID for in-row practice player (only 1 track plays at a time)
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);

  // Expandable Lyrics states for modals and cards
  const [isScheduleModalLyricsExpanded, setIsScheduleModalLyricsExpanded] = useState(false);
  const [isPracticeModalLyricsExpanded, setIsPracticeModalLyricsExpanded] = useState(false);
  const [expandedScheduleLyricsIds, setExpandedScheduleLyricsIds] = useState<Record<string, boolean>>({});
  const [copiedScheduleLyricsId, setCopiedScheduleLyricsId] = useState<string | null>(null);

  const toggleScheduleLyricsExpand = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setExpandedScheduleLyricsIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleCopyScheduleLyrics = async (id: string, lyrics: string, songTitle: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const text = `${songTitle ? `${songTitle}\n\n` : ''}${lyrics}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedScheduleLyricsId(id);
      setTimeout(() => {
        setCopiedScheduleLyricsId((prev) => (prev === id ? null : prev));
      }, 2500);
    } catch (err) {
      console.error('Failed to copy lyrics:', err);
    }
  };

  // In-line Audio Player state for Vocal Parts & Audio Tracks
  const [activeInlineTrack, setActiveInlineTrack] = useState<{
    trackId: string;
    url: string;
    trackLabel?: string;
    trackCategory: 'vocal_part' | 'attachment';
    groupId: string;
  } | null>(null);

  const handleTogglePlayInlineAudio = (
    trackId: string,
    rawUrl: string,
    trackLabel?: string,
    trackCategory: 'vocal_part' | 'attachment' = 'vocal_part',
    groupId: string = ''
  ) => {
    if (activeInlineTrack?.trackId === trackId) {
      setActiveInlineTrack(null);
    } else {
      setActivePracticeMedia(null);
      setActiveInlineTrack({
        trackId,
        url: rawUrl,
        trackLabel,
        trackCategory,
        groupId,
      });
    }
  };

  // Expandable Lyrics state per practice group
  const [expandedLyricsGroupIds, setExpandedLyricsGroupIds] = useState<Record<string, boolean>>({});
  const [copiedLyricsGroupId, setCopiedLyricsGroupId] = useState<string | null>(null);

  const toggleLyricsExpand = (groupId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setExpandedLyricsGroupIds((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const handleCopyLyrics = async (groupId: string, lyrics: string, songTitle: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const text = `${songTitle ? `${songTitle}\n\n` : ''}${lyrics}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedLyricsGroupId(groupId);
      setTimeout(() => {
        setCopiedLyricsGroupId((prev) => (prev === groupId ? null : prev));
      }, 2500);
    } catch (err) {
      console.error('Failed to copy lyrics:', err);
    }
  };



  const handleTogglePracticeDone = (group: PracticeGroupEntry, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const updatedGroup: PracticeGroupEntry = {
      ...group,
      isDone: !group.isDone,
      updatedAt: new Date().toISOString(),
    };
    if (onSavePracticeEntry) {
      onSavePracticeEntry(updatedGroup);
    }
  };

  const formatAudioTime = (sec: number) => {
    if (isNaN(sec) || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Direct Recording functions
  const startRecording = async () => {
    setRecordingError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setRecordingError('Microphone recording is not supported on this browser or platform.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      let options: MediaRecorderOptions = {};
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          options = { mimeType: 'audio/webm;codecs=opus' };
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          options = { mimeType: 'audio/webm' };
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options = { mimeType: 'audio/mp4' };
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          options = { mimeType: 'audio/ogg' };
        }
      }

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mime = recorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mime });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = reader.result as string;
          setVocalPartAudioUrl(base64Data);
          setVocalPartFileName(
            `Voice Recording - ${vocalPartLabel} (${new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })})`
          );
        };
        reader.readAsDataURL(audioBlob);

        // Stop media stream tracks
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Error starting audio recording:', err);
      setRecordingError(err?.message || 'Could not access microphone. Please grant permission.');
      setIsRecording(false);
    }
  };

  const stopRecording = (): Promise<string> => {
    return new Promise((resolve) => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        setIsRecording(false);
        resolve(vocalPartAudioUrl);
        return;
      }

      const recorder = mediaRecorderRef.current;
      recorder.onstop = () => {
        const mime = recorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mime });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = (reader.result as string) || '';
          setVocalPartAudioUrl(base64Data);
          setVocalPartFileName(
            `Voice Recording - ${vocalPartLabel} (${new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })})`
          );
          resolve(base64Data);
        };
        reader.readAsDataURL(audioBlob);

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
      };

      recorder.stop();
      setIsRecording(false);
    });
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const handleCloseVocalPartModal = () => {
    if (isRecording) {
      cancelRecording();
    }
    setIsAddingVocalPartModal(false);
    setVocalPartModalGroup(null);
    setEditingVocalPartIndex(null);
    setRecordingError(null);
  };

  const formatRecordTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Play vocal part with IndexedDB audio fallback
  const handlePlayVocalPart = async (part: PracticePartTrack, group: PracticeGroupEntry, formattedTitle: string) => {
    let playUrl = part.audioUrl || '';
    if (!playUrl || playUrl.startsWith('indexeddb:')) {
      const cached = await getAudioFromStorage(part.id);
      if (cached) playUrl = cached;
    }
    if (!playUrl) return;

    setActivePracticeMedia({
      id: part.id,
      title: `${group.songTitle} - ${formattedTitle}`,
      url: playUrl,
      type: 'audio',
      partLabel: part.partLabel,
      groupId: group.id,
    });
    setIsMediaPlaying(true);
  };

  // Play rehearsal track with IndexedDB fallback
  const handlePlayAttachment = async (att: SongAttachment, group: PracticeGroupEntry) => {
    let playUrl = att.url || att.urlOrData || '';
    if (!playUrl || playUrl.startsWith('indexeddb:')) {
      const cached = await getAudioFromStorage(att.id);
      if (cached) playUrl = cached;
    }
    if (!playUrl) return;

    setActivePracticeMedia({
      id: att.id,
      title: `${group.songTitle} - ${att.name}`,
      url: playUrl,
      type: att.type === 'audio' || att.type === 'video' ? att.type : 'audio',
      groupId: group.id,
    });
    setIsMediaPlaying(true);
  };

  const handleTogglePlayPauseMedia = () => {
    if (practiceMediaRef.current) {
      if (practiceMediaRef.current.paused) {
        practiceMediaRef.current.play().catch(() => {});
        setIsMediaPlaying(true);
      } else {
        practiceMediaRef.current.pause();
        setIsMediaPlaying(false);
      }
    } else {
      const el = document.querySelector('audio, video') as HTMLMediaElement | null;
      if (el) {
        if (el.paused) {
          el.play().catch(() => {});
          setIsMediaPlaying(true);
        } else {
          el.pause();
          setIsMediaPlaying(false);
        }
      }
    }
  };

  const handleReplayMedia = () => {
    if (practiceMediaRef.current) {
      practiceMediaRef.current.currentTime = 0;
      practiceMediaRef.current.play().catch(() => {});
      setIsMediaPlaying(true);
    } else {
      const el = document.querySelector('audio, video') as HTMLMediaElement | null;
      if (el) {
        el.currentTime = 0;
        el.play().catch(() => {});
        setIsMediaPlaying(true);
      }
    }
  };

  const lastProcessedSignalRef = React.useRef<number>(0);

  // Smart Progressive Tab Action: Return to Open -> Collapse -> Scroll to Top
  React.useEffect(() => {
    if (collapseSignal !== undefined && collapseSignal > 0 && collapseSignal !== lastProcessedSignalRef.current) {
      lastProcessedSignalRef.current = collapseSignal;

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
      if (isAddingTrackModal) {
        setIsAddingTrackModal(false);
        return;
      }
      if (isAddingVocalPartModal) {
        handleCloseVocalPartModal();
        return;
      }

      if (activeSubTab === 'schedules' && selectedEntryId) {
        const el = document.getElementById(`schedule-card-${selectedEntryId}`);
        if (el) {
          const rect = el.getBoundingClientRect();
          const inView = rect.top >= 60 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) + 80;
          if (!inView) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
          }
        }
        setSelectedEntryId(null);
        return;
      }

      if (activeSubTab === 'practice' && selectedPracticeId) {
        const el = document.getElementById(`practice-card-${selectedPracticeId}`);
        if (el) {
          const rect = el.getBoundingClientRect();
          const inView = rect.top >= 60 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) + 80;
          if (!inView) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
          }
        }
        setSelectedPracticeId(null);
        setActivePracticeMedia(null);
        return;
      }

      // If nothing is open, scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [
    collapseSignal,
    activeSubTab,
    selectedEntryId,
    selectedPracticeId,
    isEditingSchedule,
    isEditingPractice,
    isAddingTrackModal,
    isAddingVocalPartModal,
  ]);

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

    // Check if song exists in songs library
    const matchedSong = songs.find(
      (s) => s.title.toLowerCase() === trimmedTitle.toLowerCase()
    );

    // If song is not in the library, save it to the Songs library so it's persisted in the Songs Tab
    if (!matchedSong && onSaveSong) {
      const newSong: Song = {
        id: `song-${Date.now()}`,
        title: trimmedTitle,
        artist: showSongArtistInput && newSongArtist.trim() ? newSongArtist.trim() : undefined,
        lyrics: editingPractice.lyrics || '',
        updatedAt: new Date().toISOString(),
      };
      onSaveSong(newSong);
      effectiveSongId = newSong.id;
    } else if (matchedSong) {
      effectiveSongId = matchedSong.id;
      // If user provided/updated artist or lyrics, save update to the song in library
      if (
        (showSongArtistInput && newSongArtist.trim() && matchedSong.artist !== newSongArtist.trim()) ||
        (editingPractice.lyrics && editingPractice.lyrics !== matchedSong.lyrics)
      ) {
        if (onSaveSong) {
          onSaveSong({
            ...matchedSong,
            artist: showSongArtistInput && newSongArtist.trim() ? newSongArtist.trim() : matchedSong.artist,
            lyrics: editingPractice.lyrics || matchedSong.lyrics,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    const entryToSave: PracticeGroupEntry = {
      id: editingPractice.id || `prac-${Date.now()}`,
      groupName: editingPractice.groupName.trim(),
      songTitle: trimmedTitle,
      songId: effectiveSongId,
      assignedEvent: editingPractice.assignedEvent !== undefined ? editingPractice.assignedEvent.trim() : 'Sunday Service',
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
    setNewSongArtist('');
    setShowSongArtistInput(false);
  };

  // Select song from library for Practice (Title, Artist & Lyrics Autofilled)
  const handleSelectSongForPractice = (songTitleInput: string) => {
    const trimmed = songTitleInput.trim();
    const matched = songs.find(
      (s) => s.title.toLowerCase() === trimmed.toLowerCase()
    );
    if (matched) {
      setEditingPractice((prev) => ({
        ...prev,
        songTitle: matched.title,
        songId: matched.id,
        lyrics: matched.lyrics || prev?.lyrics || '',
      }));
      if (matched.artist) {
        setNewSongArtist(matched.artist);
        setShowSongArtistInput(true);
      }
    } else {
      setEditingPractice((prev) => ({
        ...prev,
        songTitle: songTitleInput,
        songId: undefined,
      }));
    }
  };

  // Handlers for Add/Edit Track & Attachment Modal (Image 2 style)
  const handleOpenAddTrackModal = (group: PracticeGroupEntry, trackIndex?: number) => {
    setTrackModalGroup(group);
    if (trackIndex !== undefined && group.customAttachments?.[trackIndex]) {
      const track = group.customAttachments[trackIndex];
      setEditingTrackIndex(trackIndex);
      setTrackCategory(track.category || 'minus_one');
      setTrackTitle(track.name || '');
      const raw = track.url || '';
      if (raw.startsWith('indexeddb:')) {
        getAudioFromStorage(track.id).then((val) => {
          if (val) setTrackUrlOrData(val);
        });
      }
      setTrackUrlOrData(raw);
      setTrackFileName('');
      setTrackType(track.type || 'link');
    } else {
      setEditingTrackIndex(null);
      setTrackCategory('minus_one');
      setTrackTitle('');
      setTrackUrlOrData('');
      setTrackFileName('');
      setTrackType('link');
    }
    setIsAddingTrackModal(true);
  };

  const handleSaveTrackModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackModalGroup) return;

    const finalTitle =
      trackTitle.trim() ||
      (trackCategory === 'plus_one' ? 'Plus One (+1) Vocal Track' : 'Minus One (-1) Backing Track');

    const attId =
      editingTrackIndex !== null && trackModalGroup.customAttachments?.[editingTrackIndex]?.id
        ? trackModalGroup.customAttachments[editingTrackIndex].id
        : `att-${Date.now()}`;

    let finalUrl = trackUrlOrData.trim();
    if (finalUrl) {
      await saveAudioToStorage(attId, finalUrl, finalTitle);
      if (finalUrl.startsWith('data:')) {
        finalUrl = `indexeddb:${attId}`;
      }
    }

    const attachmentObj: SongAttachment = {
      id: attId,
      name: finalTitle,
      url: finalUrl,
      type: trackType,
      category: trackCategory,
      uploadedAt: new Date().toISOString(),
    };

    const liveGroup = practiceEntries.find((p) => p.id === trackModalGroup.id) || trackModalGroup;
    const currentList = [...(liveGroup.customAttachments || liveGroup.attachments || [])];
    if (editingTrackIndex !== null && editingTrackIndex < currentList.length) {
      currentList[editingTrackIndex] = attachmentObj;
    } else {
      currentList.push(attachmentObj);
    }

    const currentVocalParts = liveGroup.vocalParts && liveGroup.vocalParts.length > 0
      ? liveGroup.vocalParts
      : liveGroup.parts || [];

    const updatedGroup: PracticeGroupEntry = {
      ...liveGroup,
      customAttachments: currentList,
      attachments: currentList,
      vocalParts: currentVocalParts,
      parts: currentVocalParts,
      updatedAt: new Date().toISOString(),
    };

    if (onSavePracticeEntry) {
      onSavePracticeEntry(updatedGroup);
    }

    setIsAddingTrackModal(false);
    setTrackModalGroup(null);
    setEditingTrackIndex(null);
  };

  const handleDeleteTrack = (group: PracticeGroupEntry, trackIndex: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const liveGroup = practiceEntries.find((p) => p.id === group.id) || group;
    const currentList = [...(liveGroup.customAttachments || liveGroup.attachments || [])];
    const updated = currentList.filter((_, i) => i !== trackIndex);
    const currentVocalParts = liveGroup.vocalParts && liveGroup.vocalParts.length > 0
      ? liveGroup.vocalParts
      : liveGroup.parts || [];

    if (onSavePracticeEntry) {
      onSavePracticeEntry({
        ...liveGroup,
        customAttachments: updated,
        attachments: updated,
        vocalParts: currentVocalParts,
        parts: currentVocalParts,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  // Handlers for Add/Edit Vocal Part Modal
  const handleOpenAddVocalPartModal = (
    group: PracticeGroupEntry,
    partIndex?: number,
    initialMode: 'record' | 'attach' = 'record'
  ) => {
    setVocalPartModalGroup(group);
    setIsRecording(false);
    setRecordingSeconds(0);
    setRecordingError(null);

    const partsList = group.vocalParts && group.vocalParts.length > 0 ? group.vocalParts : (group.parts || []);

    if (partIndex !== undefined && partsList[partIndex]) {
      const part = partsList[partIndex];
      setEditingVocalPartIndex(partIndex);
      if (VOCAL_PART_OPTIONS.includes(part.partLabel)) {
        setVocalPartLabel(part.partLabel);
        setVocalPartCustomLabel('');
      } else {
        setVocalPartLabel('Custom');
        setVocalPartCustomLabel(part.partLabel || '');
      }
      const assigned = Array.isArray(part.assignedUsers) && part.assignedUsers.length > 0
        ? part.assignedUsers.join(', ')
        : part.assignedTo || '';
      setVocalPartAssignedUsers(assigned);
      const rawAudio = part.audioUrl || part.urlOrData || '';
      if (rawAudio.startsWith('indexeddb:')) {
        getAudioFromStorage(part.id).then((val) => {
          if (val) setVocalPartAudioUrl(val);
        });
      }
      setVocalPartAudioUrl(rawAudio);
      setVocalPartFileName(part.name || '');
      setVocalPartAudioInputMode(initialMode || (rawAudio.startsWith('data:') ? 'record' : 'record'));
    } else {
      setEditingVocalPartIndex(null);
      setVocalPartLabel('Soprano');
      setVocalPartCustomLabel('');
      setVocalPartAssignedUsers('');
      setVocalPartAudioUrl('');
      setVocalPartFileName('');
      setVocalPartAudioInputMode(initialMode);
    }
    setIsAddingVocalPartModal(true);
  };

  const handleSaveVocalPartModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vocalPartModalGroup) return;

    let finalAudioUrl = vocalPartAudioUrl.trim();
    if (isRecording) {
      finalAudioUrl = (await stopRecording()).trim();
    }

    const label: VocalPartLabel =
      vocalPartLabel === 'Custom' && vocalPartCustomLabel.trim()
        ? (vocalPartCustomLabel.trim() as VocalPartLabel)
        : vocalPartLabel;

    const assigned = vocalPartAssignedUsers
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const liveGroup = practiceEntries.find((p) => p.id === vocalPartModalGroup.id) || vocalPartModalGroup;
    const currentList = [...(liveGroup.vocalParts && liveGroup.vocalParts.length > 0 ? liveGroup.vocalParts : (liveGroup.parts || []))];

    const partId =
      editingVocalPartIndex !== null && currentList[editingVocalPartIndex]?.id
        ? currentList[editingVocalPartIndex].id
        : `part-${Date.now()}`;

    if (finalAudioUrl) {
      await saveAudioToStorage(partId, finalAudioUrl, vocalPartFileName || `${label} Vocal Part`);
      if (finalAudioUrl.startsWith('data:')) {
        finalAudioUrl = `indexeddb:${partId}`;
      }
    }

    const partObj: PracticePartTrack = {
      id: partId,
      partLabel: label,
      assignedUsers: assigned,
      assignedTo: assigned.join(', '),
      name: vocalPartFileName || `${label} Practice Track`,
      audioUrl: finalAudioUrl,
      notes: '',
    };

    if (editingVocalPartIndex !== null && editingVocalPartIndex < currentList.length) {
      currentList[editingVocalPartIndex] = partObj;
    } else {
      currentList.push(partObj);
    }

    const updatedGroup: PracticeGroupEntry = {
      ...liveGroup,
      vocalParts: currentList,
      parts: currentList,
      updatedAt: new Date().toISOString(),
    };

    if (onSavePracticeEntry) {
      onSavePracticeEntry(updatedGroup);
    }

    handleCloseVocalPartModal();
  };

  const handleDeleteVocalPart = async (group: PracticeGroupEntry, partIndex: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const currentList = [...(group.vocalParts && group.vocalParts.length > 0 ? group.vocalParts : (group.parts || []))];
    const deletedPart = currentList[partIndex];
    if (deletedPart?.id) {
      await deleteAudioFromStorage(deletedPart.id);
    }
    const updated = currentList.filter((_, i) => i !== partIndex);
    if (onSavePracticeEntry) {
      onSavePracticeEntry({ ...group, vocalParts: updated, parts: updated, updatedAt: new Date().toISOString() });
    }
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
                      id={`schedule-card-${item.id}`}
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

                          {/* Performance Lyrics / Text with Expand / Collapse Option */}
                          {(item.lyrics || matchedSong?.lyrics) && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                  <Music className="w-3.5 h-3.5 text-sky-500" />
                                  <span>Performance Lyrics</span>
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={(e) => toggleScheduleLyricsExpand(item.id, e)}
                                    className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer transition-colors border border-slate-200 dark:border-slate-700"
                                    title={expandedScheduleLyricsIds[item.id] ? 'Collapse' : 'Expand'}
                                  >
                                    {expandedScheduleLyricsIds[item.id] ? (
                                      <>
                                        <ChevronUp className="w-3 h-3" />
                                        <span>Collapse</span>
                                      </>
                                    ) : (
                                      <>
                                        <ChevronDown className="w-3 h-3" />
                                        <span>Expand</span>
                                      </>
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) =>
                                      handleCopyScheduleLyrics(
                                        item.id,
                                        item.lyrics || matchedSong?.lyrics || '',
                                        item.songTitle || '',
                                        e
                                      )
                                    }
                                    className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer transition-colors border border-slate-200 dark:border-slate-700"
                                    title="Copy lyrics"
                                  >
                                    {copiedScheduleLyricsId === item.id ? (
                                      <>
                                        <Check className="w-3 h-3 text-emerald-500" />
                                        <span className="text-emerald-500">Copied!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3" />
                                        <span>Copy</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                              <div
                                className={`p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed transition-all ${
                                  expandedScheduleLyricsIds[item.id]
                                    ? 'max-h-none overflow-visible'
                                    : 'max-h-40 overflow-y-auto'
                                }`}
                              >
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
                  const isDone = Boolean(group.isDone);

                  return (
                    <div
                      key={group.id}
                      id={`practice-card-${group.id}`}
                      onClick={() => setSelectedPracticeId(isSelected ? null : group.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer select-none ${
                        isDone
                          ? isSelected
                            ? 'bg-slate-100 dark:bg-slate-900/90 border-slate-400 dark:border-slate-600 opacity-75 ring-2 ring-slate-400'
                            : 'bg-slate-100/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-85'
                          : isSelected
                          ? 'border-slate-900 dark:border-slate-100 ring-2 ring-slate-900 dark:ring-slate-100 bg-white dark:bg-slate-900 shadow-md'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-400'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3.5 min-w-0">
                          <div
                            className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 border ${
                              isDone
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {isDone ? <CheckCircle className="w-6 h-6" /> : <Users className="w-5 h-5" />}
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4
                                className={`text-base font-black truncate ${
                                  isDone
                                    ? 'line-through text-slate-500 dark:text-slate-400'
                                    : 'text-slate-900 dark:text-white'
                                }`}
                              >
                                {group.groupName}
                              </h4>
                              {isDone && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                                  <Check className="w-3 h-3" />
                                  <span>Done</span>
                                </span>
                              )}
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
                          {/* Toggle Done Button */}
                          <button
                            type="button"
                            onClick={(e) => handleTogglePracticeDone(group, e)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isDone
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-emerald-600'
                            }`}
                            title={isDone ? 'Mark as Not Done' : 'Mark as Done'}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const matchedSong = songs.find(
                                (s) => s.id === group.songId || s.title.toLowerCase() === group.songTitle.toLowerCase()
                              );
                              if (matchedSong?.artist) {
                                setNewSongArtist(matchedSong.artist);
                                setShowSongArtistInput(true);
                              } else {
                                setNewSongArtist('');
                                setShowSongArtistInput(false);
                              }
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
                          {/* 1. TOP HEADER SECTION: Rehearsal Lyrics with Expand / Collapse Option */}
                          <div className="space-y-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                                <Music className="w-3.5 h-3.5 text-sky-500" />
                                <span>Rehearsal Lyrics</span>
                              </span>
                              {group.lyrics && (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={(e) => toggleLyricsExpand(group.id, e)}
                                    className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer transition-colors border border-slate-200 dark:border-slate-700"
                                    title={expandedLyricsGroupIds[group.id] ? 'Collapse' : 'Expand'}
                                  >
                                    {expandedLyricsGroupIds[group.id] ? (
                                      <>
                                        <ChevronUp className="w-3 h-3" />
                                        <span>Collapse</span>
                                      </>
                                    ) : (
                                      <>
                                        <ChevronDown className="w-3 h-3" />
                                        <span>Expand</span>
                                      </>
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => handleCopyLyrics(group.id, group.lyrics || '', group.songTitle, e)}
                                    className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer transition-colors border border-slate-200 dark:border-slate-700"
                                    title="Copy lyrics"
                                  >
                                    {copiedLyricsGroupId === group.id ? (
                                      <>
                                        <Check className="w-3 h-3 text-emerald-500" />
                                        <span className="text-emerald-500">Copied!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3" />
                                        <span>Copy</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                            {group.lyrics ? (
                              <div
                                className={`p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed transition-all ${
                                  expandedLyricsGroupIds[group.id]
                                    ? 'max-h-none overflow-visible'
                                    : 'max-h-40 overflow-y-auto'
                                }`}
                              >
                                {group.lyrics}
                              </div>
                            ) : (
                              <div className="p-3 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-400 italic">
                                No lyrics provided for this song yet.
                              </div>
                            )}
                          </div>

                          {/* 2. Vocal Parts Section (Soprano, Alto, Tenor, Bass, etc.) */}
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
                                <span>
                                  Vocal Parts (
                                  {(group.vocalParts?.length || group.parts?.length || 0)}
                                  )
                                </span>
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenAddVocalPartModal(group, undefined, 'record')}
                                  className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                                  title="Directly record a vocal part with microphone"
                                >
                                  <Mic className="w-3.5 h-3.5" />
                                  <span>Record Part</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenAddVocalPartModal(group, undefined, 'attach')}
                                  className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Add Vocal Part</span>
                                </button>
                              </div>
                            </div>

                            {(() => {
                              const partsList =
                                group.vocalParts && group.vocalParts.length > 0
                                  ? group.vocalParts
                                  : group.parts || [];

                              if (partsList.length === 0) {
                                return null;
                              }

                              return (
                                /* Vertically stacked vocal part player cards */
                                <div className="grid grid-cols-1 gap-3">
                                  {partsList.map((part, pIdx) => {
                                    const assignedNames =
                                      part.assignedUsers && part.assignedUsers.length > 0
                                        ? part.assignedUsers.join(', ')
                                        : part.assignedTo || '';
                                    const rawAudio = part.audioUrl || part.urlOrData || '';

                                    return (
                                      <PracticeAudioTrackRow
                                        key={part.id || `part-${pIdx}`}
                                        id={part.id}
                                        badgeLabel={part.partLabel}
                                        badgeCategory="vocal_part"
                                        performerName={assignedNames || 'UNASSIGNED'}
                                        audioUrl={rawAudio}
                                        isCurrentlyPlaying={playingTrackId === part.id}
                                        onPlay={() => {
                                          setActivePracticeMedia(null);
                                          setPlayingTrackId(part.id);
                                        }}
                                        onPause={() => {
                                          setPlayingTrackId(null);
                                        }}
                                        onEdit={() => handleOpenAddVocalPartModal(group, pIdx)}
                                        onDelete={() => handleDeleteVocalPart(group, pIdx)}
                                        onRecordNewAudio={() => handleOpenAddVocalPartModal(group, pIdx, 'record')}
                                      />
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>

                          {/* 3. Rehearsal Tracks & Attachments (Plus-One / Minus-One) */}
                          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                                <Paperclip className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
                                <span>Rehearsal Tracks & Attachments ({group.customAttachments?.length || 0})</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleOpenAddTrackModal(group)}
                                className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add Track</span>
                              </button>
                            </div>

                            {/* Vertically stacked full-width player rows */}
                            {group.customAttachments && group.customAttachments.length > 0 && (
                              <div className="grid grid-cols-1 gap-3">
                                {group.customAttachments.map((att, aIdx) => {
                                  const isPlusOne = att.category === 'plus_one';
                                  const rawUrl = att.url || att.urlOrData || '';
                                  const isVideo =
                                    att.type === 'video' ||
                                    rawUrl.startsWith('data:video/') ||
                                    rawUrl.includes('youtube.com') ||
                                    rawUrl.includes('youtu.be');

                                  if (isVideo) {
                                    return (
                                      <div
                                        key={att.id || `track-${aIdx}`}
                                        className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 sm:p-5 transition-all flex items-center justify-between gap-3"
                                      >
                                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shrink-0 select-none">
                                            <FileVideo className="w-3.5 h-3.5" />
                                            <span className="text-xs font-black uppercase tracking-wider">
                                              {isPlusOne ? 'VIDEO (+1)' : 'VIDEO (-1)'}
                                            </span>
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <h4 className="text-base font-black tracking-wide text-slate-900 dark:text-white uppercase truncate">
                                              {att.name || 'VIDEO TRACK'}
                                            </h4>
                                          </div>
                                        </div>
                                        <div className="flex items-center space-x-2 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setPlayingTrackId(null);
                                              setActivePracticeMedia({
                                                id: att.id,
                                                title: `${group.songTitle} - ${att.name}`,
                                                url: rawUrl,
                                                type: 'video',
                                                groupId: group.id,
                                              });
                                            }}
                                            className="px-3.5 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md transition-transform hover:scale-105"
                                          >
                                            <FileVideo className="w-4 h-4" />
                                            <span>Watch Video</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleOpenAddTrackModal(group, aIdx)}
                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                            title="Edit Track"
                                          >
                                            <Pencil className="w-4 h-4" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => handleDeleteTrack(group, aIdx, e)}
                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                            title="Delete Track"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  }

                                  return (
                                    <PracticeAudioTrackRow
                                      key={att.id || `track-${aIdx}`}
                                      id={att.id}
                                      badgeLabel={isPlusOne ? 'PLUS ONE' : 'MINUS ONE'}
                                      badgeCategory={isPlusOne ? 'plus_one' : 'minus_one'}
                                      performerName={att.name || (isPlusOne ? 'Plus One Track' : 'Minus One Track')}
                                      audioUrl={rawUrl}
                                      isCurrentlyPlaying={playingTrackId === att.id}
                                      onPlay={() => {
                                        setActivePracticeMedia(null);
                                        setPlayingTrackId(att.id);
                                      }}
                                      onPause={() => {
                                        setPlayingTrackId(null);
                                      }}
                                      onEdit={() => handleOpenAddTrackModal(group, aIdx)}
                                      onDelete={() => handleDeleteTrack(group, aIdx)}
                                    />
                                  );
                                })}
                              </div>
                            )}

                            {/* REHEARSAL VIDEO PLAYER (Appears directly under Rehearsal Tracks & Attachments when triggered) */}
                            {activePracticeMedia &&
                              activePracticeMedia.groupId === group.id &&
                              (activePracticeMedia.type === 'video' || getYouTubeEmbedUrl(activePracticeMedia.url) || getGoogleDriveEmbedUrl(activePracticeMedia.url)) && (
                                <div className="p-4 rounded-2xl bg-slate-900 text-white dark:bg-slate-950 border border-slate-800 shadow-md space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                                    <div className="flex items-center space-x-2 min-w-0">
                                      <FileVideo className="w-4 h-4 text-rose-400 shrink-0" />
                                      <span className="text-xs font-bold truncate">
                                        Video: {activePracticeMedia.title}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => setIsLooping(!isLooping)}
                                        className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                                          isLooping
                                            ? 'bg-rose-500 text-white'
                                            : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                                        }`}
                                        title={isLooping ? 'Repeat Video ON' : 'Repeat Video OFF'}
                                      >
                                        <Repeat className="w-3.5 h-3.5" />
                                        <span className="text-[10px]">{isLooping ? 'Repeat ON' : 'Repeat'}</span>
                                      </button>

                                      <button
                                        onClick={() => setActivePracticeMedia(null)}
                                        className="text-slate-400 hover:text-white p-1 cursor-pointer"
                                        title="Close Video Player"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Video content */}
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

                                    const driveEmbed = getGoogleDriveEmbedUrl(activePracticeMedia.url);
                                    if (driveEmbed) {
                                      return (
                                        <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
                                          <iframe
                                            src={driveEmbed}
                                            title={activePracticeMedia.title}
                                            className="w-full h-full border-0"
                                            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                          />
                                        </div>
                                      );
                                    }

                                    return (
                                      <video
                                        ref={(el) => {
                                          practiceMediaRef.current = el;
                                        }}
                                        src={resolveMediaUrl(activePracticeMedia.url)}
                                        controls
                                        autoPlay
                                        loop={isLooping}
                                        className="w-full max-h-64 rounded-xl bg-black"
                                      />
                                    );
                                  })()}
                                </div>
                              )}

                            {/* REHEARSAL AUDIO PLAYER (Appears directly under Rehearsal Tracks & Attachments when triggered) */}
                            {activeInlineTrack &&
                              activeInlineTrack.groupId === group.id &&
                              activeInlineTrack.trackCategory === 'attachment' && (
                                <InlinePracticeAudioPlayer
                                  trackId={activeInlineTrack.trackId}
                                  url={activeInlineTrack.url}
                                  trackLabel={activeInlineTrack.trackLabel}
                                  trackCategory="attachment"
                                  groupId={group.id}
                                  onClose={() => setActiveInlineTrack(null)}
                                />
                              )}
                          </div>

                          {/* 4. REHEARSAL INSTRUCTIONS / NOTES (ALWAYS AT THE BOTTOM) */}
                          <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-slate-500" />
                              <span>Rehearsal Instructions / Notes</span>
                            </span>
                            <PracticeGroupNotesInput
                              group={group}
                              onSavePracticeEntry={onSavePracticeEntry}
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
                <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                  <AutofillInput
                    value={editingSchedule.performerName || ''}
                    onChange={(val) => setEditingSchedule({ ...editingSchedule, performerName: val })}
                    suggestions={directoryNames}
                    placeholder="Enter singer or group name"
                    inputClassName="p-2.5 text-sm text-slate-900 dark:text-white"
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
                <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
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
                    songs={songs}
                    setlists={setlists}
                    placeholder="Song title (optional / select from library)"
                    inputClassName="p-2.5 text-sm text-slate-900 dark:text-white"
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
                  placeholder="Rehearsal schedule, key, or practice notes..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              {/* Lyrics Field with Standard Sizing & Expand Toggle */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Lyrics / Performance Text (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsScheduleModalLyricsExpanded(!isScheduleModalLyricsExpanded)}
                    className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer transition-colors border border-slate-200 dark:border-slate-700"
                    title={isScheduleModalLyricsExpanded ? 'Collapse' : 'Expand'}
                  >
                    {isScheduleModalLyricsExpanded ? (
                      <>
                        <ChevronUp className="w-3 h-3" />
                        <span>Collapse</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3 h-3" />
                        <span>Expand</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  rows={isScheduleModalLyricsExpanded ? 18 : 9}
                  value={editingSchedule.lyrics || ''}
                  onChange={(e) => setEditingSchedule({ ...editingSchedule, lyrics: e.target.value })}
                  placeholder="[Verse 1]&#10;Type lyrics here...&#10;&#10;[Chorus]&#10;..."
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white leading-relaxed"
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-6">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                <span>
                  {editingPractice.id && practiceEntries.some((p) => p.id === editingPractice.id)
                    ? 'Edit Practice Session'
                    : 'Add New Practice Session'}
                </span>
              </h3>
              <button
                onClick={() => setIsEditingPractice(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePracticeSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Singer / Group Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Singer / Group Name *
                </label>
                <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                  <AutofillInput
                    value={editingPractice.groupName || ''}
                    onChange={(val) => setEditingPractice({ ...editingPractice, groupName: val })}
                    suggestions={directoryNames}
                    placeholder="Enter singer or group name"
                    inputClassName="p-2.5 text-sm text-slate-900 dark:text-white font-medium"
                  />
                </div>
              </div>

              {/* Target Event / Occasion (Optional) */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Target Event / Occasion (Optional)
                </label>
                <input
                  type="text"
                  value={editingPractice.assignedEvent !== undefined ? editingPractice.assignedEvent : 'Sunday Service'}
                  onChange={(e) => setEditingPractice({ ...editingPractice, assignedEvent: e.target.value })}
                  placeholder="Sunday Service / Event occasion"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white font-medium"
                />
              </div>

              {/* Song Title (Autofill from Songs tab database) */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Song Title *
                </label>
                <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                  <AutofillInput
                    value={editingPractice.songTitle || ''}
                    onChange={(val) => handleSelectSongForPractice(val)}
                    suggestions={songTitleSuggestions}
                    songs={songs}
                    setlists={setlists}
                    placeholder="Song title (select from library)"
                    inputClassName="p-2.5 text-sm text-slate-900 dark:text-white font-medium"
                  />
                </div>
              </div>

              {/* Optional Artist / Origin with "Add artist/origin" button (exact match of Songs Tab!) */}
              <div>
                {showSongArtistInput ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Artist / Composer / Hymn Origin
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowSongArtistInput(false);
                          setNewSongArtist('');
                        }}
                        className="text-[11px] text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                    <input
                      type="text"
                      value={newSongArtist}
                      onChange={(e) => setNewSongArtist(e.target.value)}
                      placeholder="Artist, composer, or origin"
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                      autoFocus
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSongArtistInput(true)}
                    className="text-xs font-bold text-slate-700 dark:text-slate-300 hover:underline flex items-center gap-1 cursor-pointer py-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add artist/origin</span>
                  </button>
                )}
              </div>

              {/* Lyrics Field with Expand Toggle */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Lyrics
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsPracticeModalLyricsExpanded(!isPracticeModalLyricsExpanded)}
                    className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer transition-colors border border-slate-200 dark:border-slate-700"
                    title={isPracticeModalLyricsExpanded ? 'Collapse' : 'Expand'}
                  >
                    {isPracticeModalLyricsExpanded ? (
                      <>
                        <ChevronUp className="w-3 h-3" />
                        <span>Collapse</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3 h-3" />
                        <span>Expand</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  rows={isPracticeModalLyricsExpanded ? 18 : 9}
                  value={editingPractice.lyrics || ''}
                  onChange={(e) => setEditingPractice({ ...editingPractice, lyrics: e.target.value })}
                  placeholder="[Verse 1]&#10;Type lyrics here...&#10;&#10;[Chorus]&#10;..."
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditingPractice(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-xs cursor-pointer"
                >
                  Save Practice Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD / EDIT TRACK OR ATTACHMENT MODAL (IMAGE 2 STYLE) */}
      {/* ========================================================================= */}
      {isAddingTrackModal && trackModalGroup && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-4">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-200 shrink-0">
                  <Paperclip className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingTrackIndex !== null ? 'Edit Track or Attachment' : 'Add Track or Attachment'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Attach minus-one backing tracks or plus-one vocal reference files.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddingTrackModal(false);
                  setTrackModalGroup(null);
                  setEditingTrackIndex(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveTrackModalSubmit} className="p-4 sm:p-5 space-y-4">
              {/* Attachment Category (Segmented Buttons matching Image 2) */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Attachment Category *
                </label>
                <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl gap-1">
                  <button
                    type="button"
                    onClick={() => setTrackCategory('plus_one')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      trackCategory === 'plus_one'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Mic2 className="w-3.5 h-3.5 text-sky-500" />
                    <span>Plus One (+1)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrackCategory('minus_one')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      trackCategory === 'minus_one'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Music className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Minus One (-1)</span>
                  </button>
                </div>
              </div>

              {/* Track / Attachment Title */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Track / Attachment Title
                </label>
                <input
                  type="text"
                  value={trackTitle}
                  onChange={(e) => setTrackTitle(e.target.value)}
                  placeholder={
                    trackCategory === 'plus_one'
                      ? 'Vocal Reference Track Name'
                      : 'Backing Track Name'
                  }
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {/* URL or File Attachment with Paperclip Inside */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Paste Web / YouTube Link or Attach Sound/Video File *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={trackUrlOrData}
                    onChange={(e) => {
                      setTrackUrlOrData(e.target.value);
                      setTrackFileName('');
                      setTrackType(
                        e.target.value.includes('youtube.com') ||
                        e.target.value.includes('youtu.be') ||
                        e.target.value.endsWith('.mp4')
                          ? 'video'
                          : 'link'
                      );
                    }}
                    placeholder="https://... or click paperclip on the right"
                    className="w-full pl-3 pr-11 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      handleTriggerFileUpload((url, fileName, fileType) => {
                        setTrackUrlOrData(url);
                        setTrackFileName(fileName);
                        setTrackType(fileType);
                        if (!trackTitle.trim()) {
                          setTrackTitle(fileName.replace(/\.[^/.]+$/, ''));
                        }
                      })
                    }
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                    title="Attach Audio or Video File from Device"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Paste any YouTube/audio link or click the paperclip icon on the right to attach sound or video files.
                </p>

                {trackFileName && (
                  <div className="mt-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                    <span className="truncate font-semibold">✓ Attached: {trackFileName}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setTrackUrlOrData('');
                        setTrackFileName('');
                      }}
                      className="text-emerald-600 hover:text-emerald-800 dark:hover:text-white ml-2 cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingTrackModal(false);
                    setTrackModalGroup(null);
                    setEditingTrackIndex(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!trackUrlOrData.trim()}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-xs hover:bg-slate-800 dark:hover:bg-white transition-all disabled:opacity-50 cursor-pointer"
                >
                  Save Attachment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD / EDIT VOCAL PART MODAL */}
      {/* ========================================================================= */}
      {isAddingVocalPartModal && vocalPartModalGroup && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-4">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-200 shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingVocalPartIndex !== null ? 'Edit Vocal Part' : 'Add Vocal Part'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Assign vocal parts (Soprano, Alto, Tenor, Bass) and attach vocal audio stems.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddingVocalPartModal(false);
                  setVocalPartModalGroup(null);
                  setEditingVocalPartIndex(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveVocalPartModalSubmit} className="p-4 sm:p-5 space-y-4">
              {/* Vocal Part Selection */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                  Vocal Part *
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {VOCAL_PART_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setVocalPartLabel(opt)}
                      className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center ${
                        vocalPartLabel === opt
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-900 dark:border-slate-100 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>

                {vocalPartLabel === 'Custom' && (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={vocalPartCustomLabel}
                      onChange={(e) => setVocalPartCustomLabel(e.target.value)}
                      placeholder="Enter custom vocal part name"
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                      autoFocus
                    />
                  </div>
                )}
              </div>

              {/* Assigned Member(s) with Autofill */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Assigned Member(s)
                </label>
                <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                  <AutofillInput
                    value={vocalPartAssignedUsers}
                    onChange={(val) => setVocalPartAssignedUsers(val)}
                    suggestions={directoryNames}
                    placeholder="Enter member name(s)..."
                    inputClassName="p-2.5 text-sm text-slate-900 dark:text-white font-medium"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Type a name to autofill from directory. Comma-separate for multiple singers.
                </p>
              </div>

              {/* Vocal Stem Audio: Direct Voice Recording or Attach */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Vocal Stem Audio / Recording
                  </label>
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setVocalPartAudioInputMode('record')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                        vocalPartAudioInputMode === 'record'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Mic className="w-3 h-3" />
                      <span>Record</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setVocalPartAudioInputMode('attach')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                        vocalPartAudioInputMode === 'attach'
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Paperclip className="w-3 h-3" />
                      <span>Attach / Link</span>
                    </button>
                  </div>
                </div>

                {/* Mode 1: Direct Voice Recording */}
                {vocalPartAudioInputMode === 'record' && (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
                    {recordingError && (
                      <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{recordingError}</span>
                      </div>
                    )}

                    {isRecording ? (
                      <div className="space-y-3">
                        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-300 dark:border-rose-700 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="relative flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600"></span>
                            </span>
                            <span className="text-xs font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider">
                              Recording {vocalPartLabel}...
                            </span>
                          </div>
                          <span className="text-sm font-mono font-bold text-rose-700 dark:text-rose-300 bg-white/80 dark:bg-slate-900/80 px-2.5 py-0.5 rounded-md border border-rose-200 dark:border-rose-800">
                            {formatRecordTimer(recordingSeconds)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={stopRecording}
                            className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all"
                          >
                            <Square className="w-4 h-4 fill-white" />
                            <span>Stop & Save Take</span>
                          </button>
                          <button
                            type="button"
                            onClick={cancelRecording}
                            className="py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : vocalPartAudioUrl ? (
                      <div className="space-y-2.5">
                        <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                          <span className="truncate font-semibold flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate">{vocalPartFileName || `Recorded Stem for ${vocalPartLabel}`}</span>
                          </span>
                          <span className="text-[10px] text-emerald-600 font-bold shrink-0 ml-2">Ready</span>
                        </div>

                        {/* Audio preview player */}
                        <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                          <audio
                            controls
                            src={vocalPartAudioUrl}
                            className="w-full h-8"
                          />
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={startRecording}
                            className="py-1.5 px-3 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 font-bold text-xs flex items-center gap-1.5 border border-rose-200 dark:border-rose-800 cursor-pointer transition-colors"
                          >
                            <Mic className="w-3.5 h-3.5" />
                            <span>Re-record Take</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setVocalPartAudioUrl('');
                              setVocalPartFileName('');
                            }}
                            className="text-xs text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 font-semibold cursor-pointer"
                          >
                            Remove Recording
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-2 space-y-2">
                        <button
                          type="button"
                          onClick={startRecording}
                          className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all active:scale-[0.99]"
                        >
                          <Mic className="w-4 h-4" />
                          <span>Record {vocalPartLabel} Part Directly</span>
                        </button>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Tap Record to sing or hum the vocal part directly into your microphone.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Mode 2: Attach File or Link */}
                {vocalPartAudioInputMode === 'attach' && (
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type="text"
                        value={vocalPartAudioUrl}
                        onChange={(e) => {
                          setVocalPartAudioUrl(e.target.value);
                          setVocalPartFileName('');
                        }}
                        placeholder="Paste audio link or click paperclip on the right..."
                        className="w-full pl-3 pr-11 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleTriggerFileUpload((url, fileName) => {
                            setVocalPartAudioUrl(url);
                            setVocalPartFileName(fileName);
                          })
                        }
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                        title="Attach Audio Stem File from Device"
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Paste any audio URL or click the paperclip to attach MP3/M4A/WAV files from your device.
                    </p>

                    {vocalPartFileName && (
                      <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                        <span className="truncate font-semibold">✓ Attached: {vocalPartFileName}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setVocalPartAudioUrl('');
                            setVocalPartFileName('');
                          }}
                          className="text-emerald-600 hover:text-emerald-800 dark:hover:text-white ml-2 cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleCloseVocalPartModal}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-xs hover:bg-slate-800 dark:hover:bg-white transition-all cursor-pointer"
                >
                  Save Vocal Part
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
