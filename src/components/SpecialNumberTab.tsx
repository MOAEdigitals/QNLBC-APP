import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import {
  SpecialNumberEntry,
  PracticeGroupEntry,
  PracticePartTrack,
  VocalPartLabel,
  SpecialNumbersSubTab,
  ChoirEntry,
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
import { uploadMediaToCloudStorage } from '../services/cloudMediaStorage';
import {
  resolveMediaUrl,
  getYouTubeEmbedUrl,
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
  BookOpen,
  Cloud,
  Loader2,
  UploadCloud,
} from 'lucide-react';

interface SpecialNumberTabProps {
  specialNumbers: SpecialNumberEntry[];
  practiceEntries?: PracticeGroupEntry[];
  choirEntries?: ChoirEntry[];
  songs: Song[];
  setlists: Setlist[];
  savedNames?: string[];
  onSaveSpecialNumber: (entry: SpecialNumberEntry) => void;
  onDeleteSpecialNumber: (id: string) => void;
  onSavePracticeEntry?: (entry: PracticeGroupEntry) => void;
  onDeletePracticeEntry?: (id: string) => void;
  onSaveChoirEntry?: (entry: ChoirEntry) => void;
  onDeleteChoirEntry?: (id: string) => void;
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
      id={`practice-notes-${group.id}`}
      name="practice_group_notes"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="sentences"
      spellCheck={false}
      data-form-type="other"
      data-lpignore="true"
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
  choirEntries = [],
  songs,
  setlists,
  savedNames,
  onSaveSpecialNumber,
  onDeleteSpecialNumber,
  onSavePracticeEntry,
  onDeletePracticeEntry,
  onSaveChoirEntry,
  onDeleteChoirEntry,
  onOpenSongDetail,
  onSaveSong,
  collapseSignal,
}) => {
  // Sub-tabs: Schedules (default), Practice, or Choir (persisted in localStorage)
  const [activeSubTab, setActiveSubTab] = useState<SpecialNumbersSubTab>(() => {
    try {
      const saved = localStorage.getItem('nlbc_special_numbers_subtab_v1');
      if (saved === 'schedules' || saved === 'practice' || saved === 'choir') {
        return saved as SpecialNumbersSubTab;
      }
    } catch {}
    return 'schedules';
  });

  useEffect(() => {
    try {
      localStorage.setItem('nlbc_special_numbers_subtab_v1', activeSubTab);
    } catch {}
  }, [activeSubTab]);

  // Choir state
  const [selectedChoirId, setSelectedChoirId] = useState<string | null>(null);
  const [isEditingChoir, setIsEditingChoir] = useState(false);
  const [editingChoir, setEditingChoir] = useState<Partial<ChoirEntry> | null>(null);
  const [choirSearchQuery, setChoirSearchQuery] = useState('');
  const [choirFilter, setChoirFilter] = useState<'all' | 'upcoming' | 'completed'>('all');
  const [expandedChoirLyricsIds, setExpandedChoirLyricsIds] = useState<Record<string, boolean>>({});
  const [copiedChoirLyricsId, setCopiedChoirLyricsId] = useState<string | null>(null);
  const [isChoirModalLyricsExpanded, setIsChoirModalLyricsExpanded] = useState(false);
  const [newChoirArtist, setNewChoirArtist] = useState('');
  const [showChoirArtistInput, setShowChoirArtistInput] = useState(false);

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

  // Scroll anchor reference for keeping tapped schedule card pinned in place on screen
  const scheduleAnchorRef = useRef<{
    id: string;
    initialScreenY: number;
  } | null>(null);

  // Scroll anchor reference for keeping tapped practice card pinned in place on screen
  const practiceAnchorRef = useRef<{
    id: string;
    initialScreenY: number;
  } | null>(null);

  // Precise Scroll Anchoring for Special Number Schedules
  useLayoutEffect(() => {
    const anchor = scheduleAnchorRef.current;
    if (!anchor) return;
    if (selectedEntryId !== anchor.id) {
      scheduleAnchorRef.current = null;
      return;
    }

    const cardEl = document.getElementById(`schedule-card-${anchor.id}`);
    if (!cardEl) {
      scheduleAnchorRef.current = null;
      return;
    }

    const currentScreenY = cardEl.getBoundingClientRect().top;
    const delta = currentScreenY - anchor.initialScreenY;

    const applyScrollCorrection = (offset: number) => {
      let scrollContainer: HTMLElement | null = null;
      let parent = cardEl.parentElement;
      while (parent && parent !== document.body && parent !== document.documentElement) {
        const style = window.getComputedStyle(parent);
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) {
          scrollContainer = parent;
          break;
        }
        parent = parent.parentElement;
      }

      if (scrollContainer) {
        scrollContainer.scrollTop += offset;
      } else {
        const scroller = document.scrollingElement || document.documentElement || document.body;
        const currentTop = window.scrollY || scroller.scrollTop || 0;
        const newTop = Math.max(0, currentTop + offset);
        try {
          window.scrollTo({ top: newTop, behavior: 'instant' as ScrollBehavior });
        } catch {
          window.scrollTo(0, newTop);
        }
        if (scroller && scroller.scrollTop !== newTop) {
          scroller.scrollTop = newTop;
        }
      }
    };

    if (Math.abs(delta) > 0.5) {
      applyScrollCorrection(delta);
    }

    const rafId = requestAnimationFrame(() => {
      const el = document.getElementById(`schedule-card-${anchor.id}`);
      if (el) {
        const rafScreenY = el.getBoundingClientRect().top;
        const rafDelta = rafScreenY - anchor.initialScreenY;
        if (Math.abs(rafDelta) > 1) {
          applyScrollCorrection(rafDelta);
        }
      }
      scheduleAnchorRef.current = null;
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [selectedEntryId]);

  // Precise Scroll Anchoring for Practice Sessions
  useLayoutEffect(() => {
    const anchor = practiceAnchorRef.current;
    if (!anchor) return;
    if (selectedPracticeId !== anchor.id) {
      practiceAnchorRef.current = null;
      return;
    }

    const cardEl = document.getElementById(`practice-card-${anchor.id}`);
    if (!cardEl) {
      practiceAnchorRef.current = null;
      return;
    }

    const currentScreenY = cardEl.getBoundingClientRect().top;
    const delta = currentScreenY - anchor.initialScreenY;

    const applyScrollCorrection = (offset: number) => {
      let scrollContainer: HTMLElement | null = null;
      let parent = cardEl.parentElement;
      while (parent && parent !== document.body && parent !== document.documentElement) {
        const style = window.getComputedStyle(parent);
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) {
          scrollContainer = parent;
          break;
        }
        parent = parent.parentElement;
      }

      if (scrollContainer) {
        scrollContainer.scrollTop += offset;
      } else {
        const scroller = document.scrollingElement || document.documentElement || document.body;
        const currentTop = window.scrollY || scroller.scrollTop || 0;
        const newTop = Math.max(0, currentTop + offset);
        try {
          window.scrollTo({ top: newTop, behavior: 'instant' as ScrollBehavior });
        } catch {
          window.scrollTo(0, newTop);
        }
        if (scroller && scroller.scrollTop !== newTop) {
          scroller.scrollTop = newTop;
        }
      }
    };

    if (Math.abs(delta) > 0.5) {
      applyScrollCorrection(delta);
    }

    const rafId = requestAnimationFrame(() => {
      const el = document.getElementById(`practice-card-${anchor.id}`);
      if (el) {
        const rafScreenY = el.getBoundingClientRect().top;
        const rafDelta = rafScreenY - anchor.initialScreenY;
        if (Math.abs(rafDelta) > 1) {
          applyScrollCorrection(rafDelta);
        }
      }
      practiceAnchorRef.current = null;
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [selectedPracticeId]);

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

  // Universal Cloud Media Upload state
  const [isUploadingCloudMedia, setIsUploadingCloudMedia] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState('');

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

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingFileCallbackRef.current) return;
    const fType: 'audio' | 'video' | 'file' = file.type.startsWith('audio/')
      ? 'audio'
      : file.type.startsWith('video/')
      ? 'video'
      : 'file';

    const fileId = `att-${Date.now()}`;
    setIsUploadingCloudMedia(true);
    setUploadProgress(10);
    setUploadStatusText(`Uploading "${file.name}" to Universal Cloud Media Storage...`);

    try {
      const uploadRes = await uploadMediaToCloudStorage(
        file,
        fileId,
        file.name,
        (pct) => {
          setUploadProgress(pct);
          setUploadStatusText(`Uploading "${file.name}" (${pct}%)...`);
        }
      );

      if (pendingFileCallbackRef.current) {
        pendingFileCallbackRef.current(uploadRes.url, file.name, fType);
      }
    } catch (err) {
      console.warn('Fallback saving file to IndexedDB:', err);
      const reader = new FileReader();
      reader.onload = async () => {
        const result = reader.result as string;
        try {
          await saveAudioToStorage(fileId, result, file.name);
        } catch (e) {
          console.warn('Local save error:', e);
        }
        if (pendingFileCallbackRef.current) {
          pendingFileCallbackRef.current(`indexeddb:${fileId}`, file.name, fType);
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploadingCloudMedia(false);
      setUploadProgress(0);
      setUploadStatusText('');
    }
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
      const targetId = playUrl ? playUrl.replace(/^indexeddb:/, '') : undefined;
      const cached = await getAudioFromStorage(targetId || part.id, part.id);
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
      const targetId = playUrl ? playUrl.replace(/^indexeddb:/, '') : undefined;
      const cached = await getAudioFromStorage(targetId || att.id, att.id);
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

  const directoryNames = getAllDirectoryNames(savedNames);
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

  // Choir filtering
  const filteredChoirEntries = choirEntries.filter((entry) => {
    if (choirFilter === 'upcoming' && entry.isDone) return false;
    if (choirFilter === 'completed' && !entry.isDone) return false;
    if (!choirSearchQuery.trim()) return true;
    const q = choirSearchQuery.toLowerCase();
    return (
      entry.songTitle.toLowerCase().includes(q) ||
      (entry.choirGroup && entry.choirGroup.toLowerCase().includes(q)) ||
      (entry.artist && entry.artist.toLowerCase().includes(q)) ||
      (entry.notes && entry.notes.toLowerCase().includes(q)) ||
      (entry.lyrics && entry.lyrics.toLowerCase().includes(q))
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

  // Select song from library for Choir (Title, Artist & Lyrics Autofilled)
  const handleSelectSongForChoir = (songTitleInput: string) => {
    const trimmed = songTitleInput.trim();
    const matched = songs.find(
      (s) => s.title.toLowerCase() === trimmed.toLowerCase()
    );
    if (matched) {
      setEditingChoir((prev) => ({
        ...prev,
        songTitle: matched.title,
        songId: matched.id,
        lyrics: matched.lyrics || prev?.lyrics || '',
        artist: matched.artist || prev?.artist || '',
      }));
      if (matched.artist) {
        setNewChoirArtist(matched.artist);
        setShowChoirArtistInput(true);
      }
    } else {
      setEditingChoir((prev) => ({
        ...prev,
        songTitle: songTitleInput,
      }));
    }
  };

  // Choir Save Handler
  const handleSaveChoirSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingChoir || !editingChoir.songTitle?.trim()) return;

    const trimmedTitle = editingChoir.songTitle.trim();
    const artist = showChoirArtistInput ? newChoirArtist.trim() : (editingChoir.artist || '').trim();
    const lyrics = (editingChoir.lyrics || '').trim();
    const choirGroup = (editingChoir.choirGroup || '').trim() || 'Church Choir';
    const date = editingChoir.date || getNextSundayStr();
    const notes = (editingChoir.notes || '').trim();

    let effectiveSongId = editingChoir.songId;

    // Check if song exists in songs library
    const matchedSong = songs.find(
      (s) => s.title.toLowerCase() === trimmedTitle.toLowerCase()
    );

    if (!matchedSong && lyrics && onSaveSong) {
      const newSong: Song = {
        id: `song-${Date.now()}`,
        title: trimmedTitle,
        artist: artist || undefined,
        lyrics: lyrics,
        updatedAt: new Date().toISOString(),
      };
      onSaveSong(newSong);
      effectiveSongId = newSong.id;
    } else if (matchedSong) {
      effectiveSongId = matchedSong.id;
      if (
        (artist && matchedSong.artist !== artist) ||
        (lyrics && matchedSong.lyrics !== lyrics)
      ) {
        if (onSaveSong) {
          onSaveSong({
            ...matchedSong,
            artist: artist || matchedSong.artist,
            lyrics: lyrics || matchedSong.lyrics,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    const entryToSave: ChoirEntry = {
      id: editingChoir.id || `choir-${Date.now()}`,
      date,
      songTitle: trimmedTitle,
      artist: artist || undefined,
      songId: effectiveSongId,
      lyrics: lyrics || (matchedSong ? matchedSong.lyrics : '') || '',
      notes: notes || undefined,
      choirGroup,
      isDone: editingChoir.isDone || false,
      createdAt: editingChoir.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (onSaveChoirEntry) {
      onSaveChoirEntry(entryToSave);
    }

    setIsEditingChoir(false);
    setEditingChoir(null);
    setNewChoirArtist('');
    setShowChoirArtistInput(false);
  };

  const handleToggleChoirDone = (entry: ChoirEntry) => {
    if (onSaveChoirEntry) {
      onSaveChoirEntry({
        ...entry,
        isDone: !entry.isDone,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const handleDeleteChoir = (id: string) => {
    if (window.confirm('Are you sure you want to remove this choir song entry?')) {
      if (onDeleteChoirEntry) {
        onDeleteChoirEntry(id);
      }
      if (selectedChoirId === id) {
        setSelectedChoirId(null);
      }
    }
  };

  const handleCopyChoirLyrics = (entry: ChoirEntry) => {
    if (!entry.lyrics) return;
    navigator.clipboard.writeText(entry.lyrics);
    setCopiedChoirLyricsId(entry.id);
    setTimeout(() => setCopiedChoirLyricsId(null), 2000);
  };

  const handleSaveChoirSongToLibrary = (entry: ChoirEntry) => {
    if (!entry.songTitle) return;
    const existing = songs.find(
      (s) => s.title.toLowerCase() === entry.songTitle.trim().toLowerCase()
    );
    if (!existing && onSaveSong) {
      const newSong: Song = {
        id: `song-${Date.now()}`,
        title: entry.songTitle.trim(),
        artist: entry.artist,
        lyrics: entry.lyrics || '',
        updatedAt: new Date().toISOString(),
      };
      onSaveSong(newSong);
      if (onSaveChoirEntry) {
        onSaveChoirEntry({
          ...entry,
          songId: newSong.id,
          updatedAt: new Date().toISOString(),
        });
      }
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
      setTrackUrlOrData(raw);
      if (raw.startsWith('indexeddb:') || raw.startsWith('data:')) {
        setTrackFileName(track.name || 'Attached Audio Track');
      } else {
        setTrackFileName('');
      }
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
      (trackFileName ? trackFileName.replace(/\.[^/.]+$/, '') : (trackCategory === 'plus_one' ? 'Plus One (+1) Vocal Track' : 'Minus One (-1) Track'));

    const attId =
      editingTrackIndex !== null && trackModalGroup.customAttachments?.[editingTrackIndex]?.id
        ? trackModalGroup.customAttachments[editingTrackIndex].id
        : `att-${Date.now()}`;

    let finalUrl = trackUrlOrData.trim();
    if (finalUrl) {
      if (finalUrl.startsWith('data:')) {
        setIsUploadingCloudMedia(true);
        setUploadStatusText('Syncing audio track to Universal Cloud Storage...');
        try {
          const res = await uploadMediaToCloudStorage(finalUrl, attId, finalTitle);
          finalUrl = res.url;
        } catch (err) {
          console.warn('Cloud sync fallback to local storage:', err);
          await saveAudioToStorage(attId, finalUrl, finalTitle);
          finalUrl = `indexeddb:${attId}`;
        } finally {
          setIsUploadingCloudMedia(false);
          setUploadStatusText('');
        }
      } else if (finalUrl.startsWith('indexeddb:')) {
        const existingAudioId = finalUrl.replace(/^indexeddb:/, '');
        if (existingAudioId && existingAudioId !== attId) {
          const audioData = await getAudioFromStorage(existingAudioId);
          if (audioData) {
            if (audioData.startsWith('data:')) {
              try {
                const res = await uploadMediaToCloudStorage(audioData, attId, finalTitle);
                finalUrl = res.url;
              } catch {
                await saveAudioToStorage(attId, audioData, finalTitle);
              }
            } else {
              await saveAudioToStorage(attId, audioData, finalTitle);
            }
          }
        }
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
      if (finalAudioUrl.startsWith('data:')) {
        setIsUploadingCloudMedia(true);
        setUploadStatusText(`Syncing ${label} track to Universal Cloud Storage...`);
        try {
          const res = await uploadMediaToCloudStorage(finalAudioUrl, partId, vocalPartFileName || `${label} Vocal Part`);
          finalAudioUrl = res.url;
        } catch (err) {
          console.warn('Cloud sync error for vocal part:', err);
          await saveAudioToStorage(partId, finalAudioUrl, vocalPartFileName || `${label} Vocal Part`);
          finalAudioUrl = `indexeddb:${partId}`;
        } finally {
          setIsUploadingCloudMedia(false);
          setUploadStatusText('');
        }
      } else if (finalAudioUrl.startsWith('indexeddb:')) {
        const existingAudioId = finalAudioUrl.replace(/^indexeddb:/, '');
        if (existingAudioId && existingAudioId !== partId) {
          const audioData = await getAudioFromStorage(existingAudioId);
          if (audioData) {
            if (audioData.startsWith('data:')) {
              try {
                const res = await uploadMediaToCloudStorage(audioData, partId, vocalPartFileName || `${label} Vocal Part`);
                finalAudioUrl = res.url;
              } catch {
                await saveAudioToStorage(partId, audioData, vocalPartFileName || `${label} Vocal Part`);
              }
            } else {
              await saveAudioToStorage(partId, audioData, vocalPartFileName || `${label} Vocal Part`);
            }
          }
        }
      } else {
        await saveAudioToStorage(partId, finalAudioUrl, vocalPartFileName || `${label} Vocal Part`);
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
            <span>Song Numbers</span>
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
        ) : activeSubTab === 'practice' ? (
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
        ) : (
          <button
            onClick={() => {
              setNewChoirArtist('');
              setShowChoirArtistInput(false);
              setEditingChoir({
                id: `choir-${Date.now()}`,
                choirGroup: 'Church Choir',
                songTitle: '',
                date: getNextSundayStr(),
                lyrics: '',
                notes: '',
                isDone: false,
                createdAt: new Date().toISOString(),
              });
              setIsEditingChoir(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold hover:bg-slate-800 dark:hover:bg-white transition-all shadow-xs shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Line Up Choir Song</span>
          </button>
        )}
      </div>

      {/* Sub-Tabs: Schedules, Practice, & Choir */}
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

        <button
          type="button"
          onClick={() => setActiveSubTab('choir')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer ${
            activeSubTab === 'choir'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Music className="w-4 h-4" />
          <span>Choir</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeSubTab === 'choir'
                ? 'bg-white/20 text-white dark:bg-black/20 dark:text-slate-900'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            {choirEntries.length}
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
              id="schedule-search-input"
              name="schedule_search_query"
              type="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="sentences"
              spellCheck={false}
              data-form-type="other"
              data-lpignore="true"
              value={scheduleSearchQuery}
              onChange={(e) => setScheduleSearchQuery(e.target.value)}
              placeholder="Search performer, song title, or notes..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-colors [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
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
              <div className="grid grid-cols-1 gap-3" style={{ overflowAnchor: 'none' }}>
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
                      onClick={(e) => {
                        if (isSelected) {
                          setSelectedEntryId(null);
                        } else {
                          const cardEl = e.currentTarget;
                          scheduleAnchorRef.current = {
                            id: item.id,
                            initialScreenY: cardEl.getBoundingClientRect().top,
                          };
                          setSelectedEntryId(item.id);
                        }
                      }}
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
              id="practice-search-input"
              name="practice_search_query"
              type="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="sentences"
              spellCheck={false}
              data-form-type="other"
              data-lpignore="true"
              value={practiceSearchQuery}
              onChange={(e) => setPracticeSearchQuery(e.target.value)}
              placeholder="Search singing group, song, vocal part, or singer name..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-colors [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
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
              <div className="grid grid-cols-1 gap-3" style={{ overflowAnchor: 'none' }}>
                {filteredPracticeEntries.map((group) => {
                  const isSelected = selectedPracticeId === group.id;
                  const isDone = Boolean(group.isDone);

                  return (
                    <div
                      key={group.id}
                      id={`practice-card-${group.id}`}
                      onClick={(e) => {
                        if (isSelected) {
                          setSelectedPracticeId(null);
                        } else {
                          const cardEl = e.currentTarget;
                          practiceAnchorRef.current = {
                            id: group.id,
                            initialScreenY: cardEl.getBoundingClientRect().top,
                          };
                          setSelectedPracticeId(group.id);
                        }
                      }}
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
                        <div className="min-w-0 pr-2">
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
                            {group.assignedEvent && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {group.assignedEvent}
                              </span>
                            )}
                            {isDone && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                <span>Done</span>
                              </span>
                            )}
                          </div>

                          <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5 flex items-center gap-1.5">
                            <span className="italic font-medium">Song: {group.songTitle}</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            <span>{group.vocalParts?.length || 0} vocal parts</span>
                            <span>•</span>
                            <span>{group.customAttachments?.length || 0} tracks</span>
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
                                <div className="grid grid-cols-1 gap-2.5">
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

                          {/* Distinct Clear Separation between Vocal Parts and Rehearsal Tracks */}
                          <div className="my-5 border-t-2 border-slate-200/80 dark:border-slate-800" />

                          {/* 3. Rehearsal Tracks (Plus-One / Minus-One) */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                                <Music className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
                                <span>Rehearsal Tracks ({group.customAttachments?.length || 0})</span>
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
                              <div className="grid grid-cols-1 gap-2.5">
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
                                        className="w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs px-3.5 py-2.5 sm:px-4 sm:py-3 transition-all flex items-center justify-between gap-2.5"
                                      >
                                        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                                          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shrink-0 select-none">
                                            <FileVideo className="w-3 h-3" />
                                            <span className="text-[11px] font-black uppercase tracking-wider">
                                              {isPlusOne ? 'VIDEO (+1)' : 'VIDEO (-1)'}
                                            </span>
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <h4 className="text-sm sm:text-base font-black tracking-wide text-slate-900 dark:text-white uppercase truncate">
                                              {att.name || 'VIDEO TRACK'}
                                            </h4>
                                          </div>
                                        </div>
                                        <div className="flex items-center space-x-1.5 shrink-0">
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
                                            className="px-3 py-1.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-transform hover:scale-105"
                                          >
                                            <FileVideo className="w-3.5 h-3.5" />
                                            <span>Watch</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleOpenAddTrackModal(group, aIdx)}
                                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                            title="Edit Track"
                                          >
                                            <Pencil className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => handleDeleteTrack(group, aIdx, e)}
                                            className="w-7 h-7 rounded-lg flex items-center justify-center text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                            title="Delete Track"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
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

                            {/* REHEARSAL VIDEO PLAYER (Appears directly under Rehearsal Tracks when triggered) */}
                            {activePracticeMedia &&
                              activePracticeMedia.groupId === group.id &&
                              (activePracticeMedia.type === 'video' || getYouTubeEmbedUrl(activePracticeMedia.url)) && (
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

                            {/* REHEARSAL AUDIO PLAYER (Appears directly under Rehearsal Tracks when triggered) */}
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
      {/* CHOIR SUB-TAB */}
      {/* ========================================================================= */}
      {activeSubTab === 'choir' && (
        <div className="space-y-4">
          {/* Choir Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="choir-search-input"
                name="choir_search_query"
                type="search"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="sentences"
                spellCheck={false}
                data-form-type="other"
                data-lpignore="true"
                value={choirSearchQuery}
                onChange={(e) => setChoirSearchQuery(e.target.value)}
                placeholder="Search choir song title, lyrics, notes, or ministry group..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100 shadow-xs [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
              />
              {choirSearchQuery && (
                <button
                  type="button"
                  onClick={() => setChoirSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <button
                type="button"
                onClick={() => setChoirFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  choirFilter === 'all'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                All ({choirEntries.length})
              </button>
              <button
                type="button"
                onClick={() => setChoirFilter('upcoming')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  choirFilter === 'upcoming'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Upcoming ({choirEntries.filter((c) => !c.isDone).length})
              </button>
              <button
                type="button"
                onClick={() => setChoirFilter('completed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  choirFilter === 'completed'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Presented ({choirEntries.filter((c) => c.isDone).length})
              </button>
            </div>
          </div>

          {/* Choir Songs Lineup List */}
          {filteredChoirEntries.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-700 dark:text-slate-300">
                <Music className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {choirSearchQuery || choirFilter !== 'all'
                    ? 'No matching choir songs found'
                    : 'No choir songs lined up yet'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  {choirSearchQuery || choirFilter !== 'all'
                    ? 'Try adjusting your search terms or filter selection.'
                    : 'Line up choir songs with dates, lyrics, and conductor notes. All songs stay connected with your Songs Library.'}
                </p>
              </div>
              {!choirSearchQuery && choirFilter === 'all' && (
                <button
                  type="button"
                  onClick={() => {
                    setNewChoirArtist('');
                    setShowChoirArtistInput(false);
                    setEditingChoir({
                      id: `choir-${Date.now()}`,
                      choirGroup: 'Church Choir',
                      songTitle: '',
                      date: getNextSundayStr(),
                      lyrics: '',
                      notes: '',
                      isDone: false,
                      createdAt: new Date().toISOString(),
                    });
                    setIsEditingChoir(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-white transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Line Up First Choir Song</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredChoirEntries.map((entry) => {
                const isUpcomingSunday = entry.date === getNextSundayStr();
                const isPast = isPastDate(entry.date) && !isToday(entry.date);
                const hasLyrics = Boolean(entry.lyrics?.trim());
                const isLyricsExpanded = expandedChoirLyricsIds[entry.id] || false;
                const matchedSongInDb = entry.songId
                  ? songs.find((s) => s.id === entry.songId)
                  : songs.find(
                      (s) => s.title.toLowerCase() === entry.songTitle.trim().toLowerCase()
                    );

                return (
                  <div
                    key={entry.id}
                    className={`rounded-2xl border transition-all bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4 shadow-xs ${
                      entry.isDone
                        ? 'border-slate-200 dark:border-slate-800/80 opacity-75'
                        : isUpcomingSunday
                        ? 'border-slate-300 dark:border-slate-700 ring-1 ring-slate-400/20'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Date Badge */}
                        <div
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                            entry.isDone
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                              : isUpcomingSunday
                              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                              : isToday(entry.date)
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300'
                              : isPast
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          <span>{formatDateStr(entry.date)}</span>
                          {isUpcomingSunday && !entry.isDone && (
                            <span className="text-[10px] uppercase tracking-wider px-1 rounded bg-white/20 dark:bg-black/20 font-black">
                              This Sunday
                            </span>
                          )}
                        </div>

                        {/* Choir Ministry Group Badge */}
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {entry.choirGroup || 'Church Choir'}
                        </span>
                      </div>

                      {/* Top Right Quick Actions */}
                      <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                        {/* Mark Presented Toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleChoirDone(entry)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                            entry.isDone
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                          title={entry.isDone ? 'Mark as upcoming' : 'Mark as presented on service'}
                        >
                          {entry.isDone ? (
                            <>
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>Presented</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Mark Presented</span>
                            </>
                          )}
                        </button>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingChoir(entry);
                            if (entry.artist) {
                              setNewChoirArtist(entry.artist);
                              setShowChoirArtistInput(true);
                            } else {
                              setNewChoirArtist('');
                              setShowChoirArtistInput(false);
                            }
                            setIsEditingChoir(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Edit Choir Song Lineup"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteChoir(entry.id)}
                          className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Delete Choir Song"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Song Details & Library Link */}
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <h3
                            className={`text-lg font-bold tracking-tight text-slate-900 dark:text-white ${
                              entry.isDone ? 'line-through decoration-slate-400' : ''
                            }`}
                          >
                            {entry.songTitle}
                          </h3>
                          {entry.artist && (
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                              by {entry.artist}
                            </span>
                          )}
                        </div>

                        {/* Songs Library Connection */}
                        <div className="flex items-center gap-2 pt-1 sm:pt-0">
                          {matchedSongInDb ? (
                            <button
                              type="button"
                              onClick={() => onOpenSongDetail(matchedSongInDb.id)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white underline underline-offset-2 transition-colors cursor-pointer"
                              title="Open in Songs Library"
                            >
                              <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                              <span>View in Songs Tab</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSaveChoirSongToLibrary(entry)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                              title="Save to Global Songs Library"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Save to Songs Library</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Presentation / Conductor Notes */}
                      {entry.notes && (
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2.5">
                          <FileText className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                          <div className="space-y-0.5 min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                              Presentation / Conductor Notes:
                            </span>
                            <p className="whitespace-pre-wrap leading-relaxed">{entry.notes}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Lyrics Section */}
                    {hasLyrics ? (
                      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedChoirLyricsIds((prev) => ({
                                ...prev,
                                [entry.id]: !prev[entry.id],
                              }))
                            }
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white transition-colors cursor-pointer"
                          >
                            {isLyricsExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                            )}
                            <span>Choir Lyrics</span>
                            <span className="text-[10px] font-normal text-slate-400">
                              ({entry.lyrics!.trim().split('\n').length} lines)
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopyChoirLyrics(entry)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                            title="Copy Lyrics to Clipboard"
                          >
                            {copiedChoirLyricsId === entry.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                  Copied!
                                </span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy Lyrics</span>
                              </>
                            )}
                          </button>
                        </div>

                        {isLyricsExpanded && (
                          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                            {entry.lyrics}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                        <span className="italic">No lyrics attached yet</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingChoir(entry);
                            setIsEditingChoir(true);
                          }}
                          className="text-slate-600 dark:text-slate-300 hover:underline cursor-pointer"
                        >
                          + Add Lyrics
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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

            <form onSubmit={handleSaveScheduleSubmit} autoComplete="off" data-form-type="other" className="p-4 sm:p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Singer / Performer Name(s) *
                </label>
                <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                  <AutofillInput
                    id="schedule-performer-input"
                    name="schedule_performer_name"
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
                  id="schedule-date-input"
                  name="schedule_service_date"
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
                    id="schedule-song-title-input"
                    name="schedule_song_title"
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
                  id="schedule-minus-one-link"
                  name="perf_minus_one_link"
                  type="url"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  data-form-type="other"
                  data-lpignore="true"
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
                  id="schedule-notes-input"
                  name="perf_rehearsal_notes"
                  type="text"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="sentences"
                  spellCheck={false}
                  data-form-type="other"
                  data-lpignore="true"
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
                  id="schedule-lyrics-input"
                  name="perf_lyrics_content"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="sentences"
                  spellCheck={false}
                  data-form-type="other"
                  data-lpignore="true"
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

            <form onSubmit={handleSavePracticeSubmit} autoComplete="off" data-form-type="other" className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Singer / Group Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Singer / Group Name *
                </label>
                <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                  <AutofillInput
                    id="practice-group-name"
                    name="practice_group_name"
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
                  id="practice-assigned-event"
                  name="practice_assigned_event"
                  type="text"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="words"
                  spellCheck={false}
                  data-form-type="other"
                  data-lpignore="true"
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
                    id="practice-song-title"
                    name="practice_song_title"
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
                      id="practice-song-artist"
                      name="practice_song_artist"
                      type="text"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="words"
                      spellCheck={false}
                      data-form-type="other"
                      data-lpignore="true"
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
                  id="practice-lyrics-input"
                  name="practice_lyrics_content"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="sentences"
                  spellCheck={false}
                  data-form-type="other"
                  data-lpignore="true"
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
            <form onSubmit={handleSaveTrackModalSubmit} autoComplete="off" data-form-type="other" className="p-4 sm:p-5 space-y-4">
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

              {/* Attachment Title */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Attachment Title
                </label>
                <input
                  id="special-track-title"
                  name="special_track_title"
                  type="text"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="sentences"
                  spellCheck={false}
                  data-form-type="other"
                  data-lpignore="true"
                  value={trackTitle}
                  onChange={(e) => setTrackTitle(e.target.value)}
                  placeholder={
                    trackCategory === 'plus_one'
                      ? 'Vocal Reference Track Name'
                      : 'Track Name'
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
                    id="special-track-url"
                    name="special_track_url"
                    type="text"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    data-form-type="other"
                    data-lpignore="true"
                    value={
                      trackUrlOrData.startsWith('indexeddb:') || trackUrlOrData.startsWith('data:')
                        ? (trackFileName ? `Attached: ${trackFileName}` : '(Attached Audio Track)')
                        : trackUrlOrData
                    }
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
                  Paste YouTube or direct audio/video links, or click paperclip to attach files.
                </p>

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

                {/* Cloud Synced Attachment Status */}
                {!isUploadingCloudMedia && trackFileName && (
                  <div className="mt-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                    <span className="truncate font-semibold flex items-center gap-1.5">
                      <Cloud className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate">Attached & Cloud-Synced: {trackFileName}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setTrackUrlOrData('');
                        setTrackFileName('');
                      }}
                      className="text-emerald-700 hover:text-rose-600 ml-2 font-bold cursor-pointer"
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
                  disabled={isUploadingCloudMedia}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploadingCloudMedia || !trackUrlOrData.trim()}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-xs hover:bg-slate-800 dark:hover:bg-white transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {isUploadingCloudMedia ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Syncing Cloud...</span>
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
            <form onSubmit={handleSaveVocalPartModalSubmit} autoComplete="off" data-form-type="other" className="p-4 sm:p-5 space-y-4">
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
                      id="vocal-part-custom-name"
                      name="vocal_part_custom_name"
                      type="text"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="words"
                      spellCheck={false}
                      data-form-type="other"
                      data-lpignore="true"
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
                    id="vocal-part-assigned-users"
                    name="vocal_part_assigned_users"
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
                        id="vocal-part-audio-url"
                        name="vocal_part_audio_url"
                        type="text"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        data-form-type="other"
                        data-lpignore="true"
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
                      Paste direct audio/media URL or click paperclip to attach files from device.
                    </p>

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

                    {!isUploadingCloudMedia && vocalPartFileName && (
                      <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                        <span className="truncate font-semibold flex items-center gap-1.5">
                          <Cloud className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">Attached & Cloud-Synced: {vocalPartFileName}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setVocalPartAudioUrl('');
                            setVocalPartFileName('');
                          }}
                          className="text-emerald-700 hover:text-rose-600 ml-2 font-bold cursor-pointer"
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
                  disabled={isUploadingCloudMedia}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploadingCloudMedia}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-xs hover:bg-slate-800 dark:hover:bg-white transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isUploadingCloudMedia ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Syncing Cloud...</span>
                    </>
                  ) : (
                    <span>Save Vocal Part</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CHOIR MODAL (Create / Edit Choir Song Lineup) */}
      {/* ========================================================================= */}
      {isEditingChoir && editingChoir && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-4">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Music className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                <span>
                  {editingChoir.id && choirEntries.some((c) => c.id === editingChoir.id)
                    ? 'Edit Choir Song Lineup'
                    : 'Line Up Choir Song'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEditingChoir(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveChoirSubmit} autoComplete="off" data-form-type="other" className="p-4 sm:p-5 space-y-4">
              {/* Service Date & Preset Buttons */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Service Presentation Date <span className="text-rose-500">*</span>
                </label>
                <input
                  id="choir-service-date"
                  name="choir_service_date"
                  type="date"
                  required
                  value={editingChoir.date}
                  onChange={(e) => setEditingChoir({ ...editingChoir, date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingChoir({ ...editingChoir, date: getNextSundayStr() })
                    }
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    This Sunday
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(getNextSundayStr());
                      d.setDate(d.getDate() + 7);
                      setEditingChoir({ ...editingChoir, date: d.toISOString().split('T')[0] });
                    }}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    Next Sunday
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(getNextSundayStr());
                      d.setDate(d.getDate() + 14);
                      setEditingChoir({ ...editingChoir, date: d.toISOString().split('T')[0] });
                    }}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    Following Sunday
                  </button>
                </div>
              </div>

              {/* Choir Ministry Group */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Choir Group / Ministry
                </label>
                <input
                  id="choir-group-name"
                  name="choir_group_name"
                  type="text"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="words"
                  spellCheck={false}
                  data-form-type="other"
                  data-lpignore="true"
                  value={editingChoir.choirGroup || ''}
                  onChange={(e) =>
                    setEditingChoir({ ...editingChoir, choirGroup: e.target.value })
                  }
                  placeholder="e.g. Church Choir, Youth Choir, Junior Choir"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <div className="flex flex-wrap gap-1.5">
                  {['Church Choir', 'Youth Choir', 'Junior Choir', "Men's Choir", "Ladies' Choir"].map(
                    (groupName) => (
                      <button
                        key={groupName}
                        type="button"
                        onClick={() =>
                          setEditingChoir({ ...editingChoir, choirGroup: groupName })
                        }
                        className={`px-2 py-0.5 text-[11px] font-medium rounded-md cursor-pointer transition-colors ${
                          editingChoir.choirGroup === groupName
                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {groupName}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Choir Song Title (Connected to Song Library) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Choir Song Title <span className="text-rose-500">*</span>
                </label>
                <AutofillInput
                  id="choir-song-title-input"
                  name="choir_song_title"
                  value={editingChoir.songTitle}
                  onChange={(val) => {
                    const matchedSong = songs.find(
                      (s) => s.title.trim().toLowerCase() === val.trim().toLowerCase()
                    );
                    setEditingChoir({
                      ...editingChoir,
                      songTitle: val,
                      songId: matchedSong ? matchedSong.id : undefined,
                      lyrics:
                        editingChoir.lyrics?.trim()
                          ? editingChoir.lyrics
                          : matchedSong?.lyrics || '',
                    });
                  }}
                  onSelectSuggestion={(suggestion) => {
                    const matchedSong = songs.find((s) => s.title === suggestion);
                    if (matchedSong) {
                      handleSelectSongForChoir(matchedSong);
                    } else {
                      setEditingChoir({ ...editingChoir, songTitle: suggestion });
                    }
                  }}
                  suggestions={songs.map((s) => s.title)}
                  placeholder="Select or type choir song title..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <p className="text-[11px] text-slate-400">
                  Type to search from existing songs in Songs Tab, or enter a new title.
                </p>
              </div>

              {/* Artist / Composer */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Composer / Artist / Arranger (Optional)
                  </label>
                  {!showChoirArtistInput && !editingChoir.artist && (
                    <button
                      type="button"
                      onClick={() => setShowChoirArtistInput(true)}
                      className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white underline cursor-pointer"
                    >
                      + Add Composer
                    </button>
                  )}
                </div>
                {(showChoirArtistInput || editingChoir.artist) && (
                  <input
                    id="choir-artist-input"
                    name="choir_artist_input"
                    type="text"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="words"
                    spellCheck={false}
                    data-form-type="other"
                    data-lpignore="true"
                    value={newChoirArtist || editingChoir.artist || ''}
                    onChange={(e) => {
                      setNewChoirArtist(e.target.value);
                      setEditingChoir({ ...editingChoir, artist: e.target.value });
                    }}
                    placeholder="e.g. Fanny Crosby / Arr. Camp Kirkland"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                )}
              </div>

              {/* Presentation / Conductor Notes */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Presentation / Conductor Notes (Optional)
                </label>
                <textarea
                  id="choir-conductor-notes"
                  name="choir_conductor_notes"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="sentences"
                  spellCheck={false}
                  data-form-type="other"
                  data-lpignore="true"
                  rows={2}
                  value={editingChoir.notes || ''}
                  onChange={(e) => setEditingChoir({ ...editingChoir, notes: e.target.value })}
                  placeholder="e.g. Modulation on Verse 3, Tenors hold final high Eb, attire is formal black & white..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
                />
              </div>

              {/* Lyrics Box */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Lyrics & Arrangement
                </label>
                <textarea
                  id="choir-lyrics-arrangement"
                  name="choir_lyrics_arrangement"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="sentences"
                  spellCheck={false}
                  data-form-type="other"
                  data-lpignore="true"
                  rows={5}
                  value={editingChoir.lyrics || ''}
                  onChange={(e) => setEditingChoir({ ...editingChoir, lyrics: e.target.value })}
                  placeholder="Paste choir arrangement lyrics here..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 leading-relaxed"
                />
              </div>

              {/* Status Toggle */}
              <div className="pt-2">
                <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={editingChoir.isDone || false}
                    onChange={(e) =>
                      setEditingChoir({ ...editingChoir, isDone: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 focus:ring-slate-900"
                  />
                  <span>Mark as Presented / Sang on Service</span>
                </label>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditingChoir(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold shadow-xs hover:bg-slate-800 dark:hover:bg-white transition-all cursor-pointer"
                >
                  Save Choir Lineup
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
