import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  MoreVertical,
  Repeat,
  Pencil,
  Trash2,
  Mic,
  Download,
  Music,
  AlertCircle,
  ExternalLink,
  Upload,
  RefreshCw,
  Loader2,
  Cloud,
  CheckCircle2,
} from 'lucide-react';
import { getAudioFromStorage, subscribeToAudioUpdates } from '../utils/audioStorage';
import {
  registerActiveAudio,
  notifyAudioStopped,
  subscribeToActiveAudioChange,
} from '../utils/audioCoordinator';
import { resolveMediaUrl } from '../utils/mediaUtils';
import { uploadMediaToCloudStorage, syncLocalAudioToCloud } from '../services/cloudMediaStorage';

export interface PracticeAudioTrackRowProps {
  id: string;
  badgeLabel: string; // e.g. "TENOR", "SOPRANO", "ALTO", "BASS", "MINUS ONE", "PLUS ONE"
  badgeCategory?: 'vocal_part' | 'minus_one' | 'plus_one' | 'custom';
  performerName: string; // e.g. "ROGER", "SIS. CLARISSE", "STUDIO REFERENCE"
  subtitle?: string;
  audioUrl?: string; // dataUrl, blobUrl, indexeddb:id, or http link
  isCurrentlyPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRecordNewAudio?: () => void;
  onAudioUrlUpdated?: (newCloudUrl: string) => void;
}

export const PracticeAudioTrackRow: React.FC<PracticeAudioTrackRowProps> = ({
  id,
  badgeLabel,
  performerName,
  subtitle,
  audioUrl,
  isCurrentlyPlaying,
  onPlay,
  onPause,
  onEdit,
  onDelete,
  onRecordNewAudio,
  onAudioUrlUpdated,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [resolvedAudioSrc, setResolvedAudioSrc] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [, setIsDragging] = useState<boolean>(false);

  const [isUploadingCloud, setIsUploadingCloud] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isCheckingSync, setIsCheckingSync] = useState<boolean>(false);

  const isWebUrl = Boolean(
    audioUrl && (audioUrl.startsWith('http://') || audioUrl.startsWith('https://'))
  );

  const isIndexedDb = Boolean(audioUrl && audioUrl.trim().startsWith('indexeddb:'));

  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  // Format seconds to mm:ss
  const formatTime = (sec: number) => {
    if (isNaN(sec) || !isFinite(sec) || sec < 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Resolve audio source (checking memory cache, IndexedDB, or direct URL)
  useEffect(() => {
    let isCancelled = false;

    const resolveSource = async () => {
      setAudioError(null);
      if (!audioUrl || !audioUrl.trim()) {
        const stored = await getAudioFromStorage(id);
        if (!isCancelled) {
          if (stored) {
            setResolvedAudioSrc(stored);
            setAudioError(null);
          } else {
            setResolvedAudioSrc('');
          }
        }
        return;
      }

      const raw = audioUrl.trim();
      if (raw.startsWith('indexeddb:')) {
        const targetId = raw.replace(/^indexeddb:/, '');
        const stored = await getAudioFromStorage(targetId, id);
        if (!isCancelled) {
          if (stored) {
            setResolvedAudioSrc(stored);
            setAudioError(null);

            // If we have the audio in IndexedDB on THIS device (e.g. phone),
            // auto-upload it to Cloudflare R2 so all other devices (laptop!) get it!
            if (onAudioUrlUpdated && !isUploadingCloud) {
              syncLocalAudioToCloud(targetId, performerName, id).then((cloudUrl) => {
                if (cloudUrl && !isCancelled) {
                  console.log(`[Auto-Sync] Cloud-synced local track ${targetId} -> ${cloudUrl}`);
                  onAudioUrlUpdated(cloudUrl);
                }
              }).catch((err) => {
                console.warn('[Auto-Sync] Background sync to Cloudflare R2 deferred:', err);
              });
            }
          } else {
            setResolvedAudioSrc('');
            setAudioError('Saved audio recording not found on this device');
          }
        }
      } else if (raw.startsWith('data:')) {
        setResolvedAudioSrc(raw);
        setAudioError(null);
      } else {
        const clean = resolveMediaUrl(raw);
        setResolvedAudioSrc(clean);
        setAudioError(null);
      }
    };

    resolveSource();

    // Listen for storage events (e.g. when an audio file finishes saving into IndexedDB or memcache)
    const unsubscribe = subscribeToAudioUpdates((audioId) => {
      const cleanRawId = audioUrl ? audioUrl.trim().replace(/^indexeddb:/, '') : '';
      if (audioId === id || audioId === cleanRawId) {
        resolveSource();
      }
    });

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [id, audioUrl, onAudioUrlUpdated]);

  // Keep onPause reference fresh
  const onPauseRef = useRef(onPause);
  useEffect(() => {
    onPauseRef.current = onPause;
  }, [onPause]);

  const isDraggingRef = useRef(false);

  // Handle HTML Audio element setup - only re-create when resolved audio source changes
  useEffect(() => {
    if (!resolvedAudioSrc) {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.src = '';
        } catch (_) {}
        audioRef.current = null;
      }
      return;
    }

    const audio = new Audio();
    audioRef.current = audio;
    audio.preload = 'metadata';
    audio.src = resolvedAudioSrc;
    audio.loop = isLooping;

    const handleLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      } else if (audio.duration === Infinity) {
        // Chromium WebM duration fix: seek to far end to force duration calculation
        audio.currentTime = 1e101;
        audio.ontimeupdate = () => {
          audio.ontimeupdate = null;
          if (isFinite(audio.duration)) {
            setDuration(audio.duration);
          }
          audio.currentTime = 0;
        };
      }
      setAudioError(null);
    };

    const handleDurationChange = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      if (!isDraggingRef.current) {
        setCurrentTime(audio.currentTime);
        if (audio.duration && isFinite(audio.duration)) {
          setDuration(audio.duration);
        }
        // Safety check for end of playback if ended event is missed
        if (!audio.loop && audio.duration > 0 && audio.currentTime >= audio.duration - 0.05) {
          setCurrentTime(0);
          audio.currentTime = 0;
          onPauseRef.current();
        }
      }
    };

    const handleEnded = () => {
      if (!audio.loop) {
        setCurrentTime(0);
        audio.currentTime = 0;
        onPauseRef.current();
      }
    };

    const handleError = () => {
      console.warn(`Audio loading error for track ${id}`);
      setAudioError('Audio playback failed');
      onPauseRef.current();
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      try {
        audio.pause();
        audio.src = '';
      } catch (_) {}
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audioRef.current = null;
    };
  }, [resolvedAudioSrc, id]);

  // Sync Loop state to audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.loop = isLooping;
    }
  }, [isLooping]);

  // Listen to global coordinator: If another player across the app starts playing, pause this track cleanly
  useEffect(() => {
    const unsub = subscribeToActiveAudioChange((activeId) => {
      if (activeId && activeId !== id && isCurrentlyPlaying) {
        onPause();
      }
    });
    return unsub;
  }, [id, isCurrentlyPlaying, onPause]);

  // Sync isCurrentlyPlaying prop to audioRef element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isCurrentlyPlaying) {
      registerActiveAudio(id, audio, onPause);
      audio.play().catch((err) => {
        console.warn('Auto-play was blocked or failed:', err);
        setAudioError('Tap play again');
        onPauseRef.current();
      });
    } else {
      audio.pause();
      notifyAudioStopped(id);
    }
  }, [isCurrentlyPlaying, id]);

  // Handle Play/Pause Toggle
  const handleTogglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();

    // If external Web link and not directly audio-playable
    if (audioError && isWebUrl && audioUrl) {
      window.open(audioUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    if (!resolvedAudioSrc) {
      if (onRecordNewAudio) {
        onRecordNewAudio();
      }
      return;
    }

    if (isCurrentlyPlaying) {
      onPause();
    } else {
      onPlay();
    }
  };

  // Direct upload of an MP3 file (e.g. from the laptop to fix missing track)
  const handleUploadTrackDirectly = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingCloud(true);
    setUploadProgress(10);
    setAudioError(null);

    try {
      const res = await uploadMediaToCloudStorage(
        file,
        id,
        file.name,
        (pct) => setUploadProgress(pct)
      );

      if (res.url) {
        setResolvedAudioSrc(res.url);
        setAudioError(null);
        if (onAudioUrlUpdated) {
          onAudioUrlUpdated(res.url);
        }
      }
    } catch (err: any) {
      console.error('Direct audio upload error:', err);
      setAudioError(`Upload failed: ${err?.message || 'Network error'}`);
    } finally {
      setIsUploadingCloud(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Check / retry cloud sync
  const handleRetrySync = async () => {
    setIsCheckingSync(true);
    const raw = (audioUrl || '').trim();
    const targetId = raw.replace(/^indexeddb:/, '');

    try {
      const stored = await getAudioFromStorage(targetId, id);
      if (stored) {
        setResolvedAudioSrc(stored);
        setAudioError(null);
        if (onAudioUrlUpdated) {
          setIsUploadingCloud(true);
          const cloudUrl = await syncLocalAudioToCloud(targetId, performerName);
          setIsUploadingCloud(false);
          if (cloudUrl) {
            onAudioUrlUpdated(cloudUrl);
          }
        }
      } else {
        setAudioError('Saved audio recording not found on this device');
      }
    } catch (err) {
      console.warn('Retry sync error:', err);
    } finally {
      setIsCheckingSync(false);
    }
  };

  // Scrubber scrubbing calculations
  const calculateScrubPosition = useCallback(
    (clientX: number) => {
      if (!progressBarRef.current || !duration) return 0;
      const rect = progressBarRef.current.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const pct = Math.max(0, Math.min(1, clickX / rect.width));
      return pct * duration;
    },
    [duration]
  );

  const handleProgressBarMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!duration || !audioRef.current) return;

    isDraggingRef.current = true;
    setIsDragging(true);

    const newTime = calculateScrubPosition(e.clientX);
    setCurrentTime(newTime);
    audioRef.current.currentTime = newTime;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current || !audioRef.current) return;
      const time = calculateScrubPosition(moveEvent.clientX);
      setCurrentTime(time);
      audioRef.current.currentTime = time;
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleProgressBarTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!duration || !audioRef.current) return;

    isDraggingRef.current = true;
    setIsDragging(true);

    const newTime = calculateScrubPosition(e.touches[0].clientX);
    setCurrentTime(newTime);
    audioRef.current.currentTime = newTime;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (!isDraggingRef.current || !audioRef.current) return;
      const time = calculateScrubPosition(moveEvent.touches[0].clientX);
      setCurrentTime(time);
      audioRef.current.currentTime = time;
    };

    const handleTouchEnd = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };

    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
  };

  // Badge background coloring
  const getBadgeStyle = (label: string) => {
    const upper = label.toUpperCase();
    if (upper.includes('SOPRANO')) {
      return 'bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border-pink-200 dark:border-pink-800/40';
    }
    if (upper.includes('ALTO')) {
      return 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800/40';
    }
    if (upper.includes('TENOR')) {
      return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/40';
    }
    if (upper.includes('BASS')) {
      return 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800/40';
    }
    if (upper.includes('PLUS ONE')) {
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40';
    }
    if (upper.includes('MINUS ONE')) {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800/40';
    }
    return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  };

  // External link opener
  const handleOpenExternal = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioUrl) {
      window.open(audioUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Download local audio file
  const handleDownloadAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    if (!resolvedAudioSrc) return;

    try {
      const a = document.createElement('a');
      a.href = resolvedAudioSrc;
      a.download = `${performerName.replace(/\s+/g, '_')}_${badgeLabel}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.warn('Could not trigger direct download:', err);
    }
  };

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const hasAudioSource = Boolean(resolvedAudioSrc || (audioUrl && audioUrl.trim()));

  return (
    <div
      id={`practice-track-${id}`}
      className={`relative px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border transition-all duration-150 shadow-2xs ${
        isCurrentlyPlaying
          ? 'bg-emerald-500/10 dark:bg-emerald-950/30 border-emerald-500/50 dark:border-emerald-600/60 ring-1 ring-emerald-500/30'
          : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
      }`}
    >
      {/* Hidden file input for laptop/desktop direct MP3 upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.aac"
        className="hidden"
        onChange={handleUploadTrackDirectly}
      />

      {/* Top Row: Pill Badge + Track Title/Subtitle + Play Button + Menu */}
      <div className="flex items-center justify-between gap-2">
        {/* Left Side: Badge + Track Info */}
        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
          {/* Vocal / Track Category Pill Badge */}
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold tracking-wider uppercase border shrink-0 ${getBadgeStyle(
              badgeLabel
            )}`}
          >
            {badgeLabel}
          </span>

          {/* Track Title & Subtitle */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-1.5 min-w-0">
              <h5 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate tracking-tight">
                {performerName}
              </h5>
              {isWebUrl && (
                <span
                  title="Web link"
                  className="inline-flex items-center text-sky-500 hover:text-sky-600 shrink-0"
                >
                  <ExternalLink className="w-3 h-3" />
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-[11px] text-slate-700 dark:text-slate-300 truncate mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right Side: Circular Play Button & 3-Dots Menu */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          {/* Uploading indicator */}
          {isUploadingCloud && (
            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-1 rounded-lg">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>{uploadProgress > 0 ? `${uploadProgress}%` : 'Syncing...'}</span>
            </div>
          )}

          {/* Play / Pause Circular Button */}
          <button
            type="button"
            id={`play-btn-${id}`}
            onClick={handleTogglePlay}
            disabled={isUploadingCloud}
            aria-label={isCurrentlyPlaying ? 'Pause Audio' : 'Play Audio'}
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer shadow-xs hover:scale-105 active:scale-95 ${
              isCurrentlyPlaying
                ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                : hasAudioSource && !audioError
                ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-100'
                : audioError && isWebUrl
                ? 'bg-sky-600 text-white hover:bg-sky-500'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-rose-600 hover:text-white'
            }`}
            title={
              hasAudioSource && !audioError
                ? isCurrentlyPlaying
                  ? 'Pause Audio'
                  : 'Play Audio'
                : audioError && isWebUrl
                ? 'Open link in new tab'
                : 'No audio recorded yet — click to record'
            }
          >
            {isCurrentlyPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : hasAudioSource && !audioError ? (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            ) : audioError && isWebUrl ? (
              <ExternalLink className="w-3.5 h-3.5" />
            ) : (
              <Mic className="w-3.5 h-3.5" />
            )}
          </button>

          {/* 3-Dots Dropdown Menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              id={`track-menu-btn-${id}`}
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(!isMenuOpen);
              }}
              aria-label="Track options"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Dropdown Popover */}
            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl py-1.5 z-30 animate-in fade-in zoom-in-95 duration-150">
                {isWebUrl && audioUrl && (
                  <button
                    type="button"
                    onClick={(e) => {
                      setIsMenuOpen(false);
                      handleOpenExternal(e);
                    }}
                    className="w-full px-3.5 py-1.5 text-left text-xs font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Link in New Tab</span>
                  </button>
                )}

                {/* Upload or replace audio file */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(false);
                    fileInputRef.current?.click();
                  }}
                  className="w-full px-3.5 py-1.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{hasAudioSource ? 'Upload / Replace Audio File' : 'Upload MP3 Track'}</span>
                </button>

                {/* If audio is in local IndexedDB, offer manual Cloud Sync */}
                {isIndexedDb && resolvedAudioSrc && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      handleRetrySync();
                    }}
                    className="w-full px-3.5 py-1.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Cloud className="w-3.5 h-3.5 text-blue-500" />
                    <span>Sync to Cloud Now</span>
                  </button>
                )}

                {onRecordNewAudio && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      onRecordNewAudio();
                    }}
                    className="w-full px-3.5 py-1.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Mic className="w-3.5 h-3.5 text-rose-500" />
                    <span>{hasAudioSource ? 'Re-record Voice Take' : 'Record Voice Audio'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(false);
                    onEdit();
                  }}
                  className="w-full px-3.5 py-1.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5 text-slate-500" />
                  <span>Edit Details</span>
                </button>

                {hasAudioSource && !isWebUrl && (
                  <button
                    type="button"
                    onClick={handleDownloadAudio}
                    className="w-full px-3.5 py-1.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Download Audio</span>
                  </button>
                )}

                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(false);
                    onDelete();
                  }}
                  className="w-full px-3.5 py-1.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Part</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Compact Scrubber Line + [00:30] ................ [🔁] */}
      <div className="mt-2 pt-0.5 space-y-1">
        {/* Interactive Scrubber Track Bar */}
        <div
          ref={progressBarRef}
          onMouseDown={handleProgressBarMouseDown}
          onTouchStart={handleProgressBarTouchStart}
          className="relative w-full h-3 flex items-center cursor-pointer group py-0.5"
          role="slider"
          aria-valuenow={currentTime}
          aria-valuemin={0}
          aria-valuemax={duration}
          tabIndex={0}
        >
          {/* Background Track Line */}
          <div className="w-full h-1 bg-slate-900/80 dark:bg-slate-700 rounded-full relative overflow-visible">
            {/* Played Progress Line */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-emerald-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
            {/* Green Circular Thumb Dot Indicator */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 shadow-xs transition-transform group-hover:scale-125"
              style={{ left: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Countdown Remaining Time & Repeat Loop Button */}
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-700 dark:text-slate-300 select-none">
          {/* Remaining Countdown Time (starts at total duration, counts down to 00:00) */}
          <span className="font-semibold tracking-wider" title="Remaining time">
            {formatTime(Math.max(0, duration - currentTime))}
          </span>

          {/* Right Side: Loop / Repeat Icon Button */}
          <div className="flex items-center space-x-1">
            <button
              type="button"
              id={`loop-btn-${id}`}
              onClick={(e) => {
                e.stopPropagation();
                setIsLooping(!isLooping);
              }}
              aria-label={isLooping ? 'Repeat loop enabled' : 'Repeat loop disabled'}
              className={`p-0.5 rounded transition-colors cursor-pointer flex items-center justify-center ${
                isLooping
                  ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400'
                  : 'text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
              title={isLooping ? 'Repeat loop: ON' : 'Repeat loop: OFF'}
            >
              <Repeat className={`w-3.5 h-3.5 ${isLooping ? 'stroke-[2.5]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Audio Missing on Current Device (e.g. Phone -> Laptop sync pending) */}
        {audioError === 'Saved audio recording not found on this device' ? (
          <div className="mt-1.5 p-2 rounded-lg bg-sky-500/10 border border-sky-500/25 text-slate-800 dark:text-slate-200 text-xs space-y-1.5">
            <div className="flex items-start gap-1.5">
              <AlertCircle className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
              <div className="leading-snug">
                <span className="font-bold text-sky-700 dark:text-sky-400">
                  Audio saved on original device (Phone):
                </span>{' '}
                <span className="text-slate-600 dark:text-slate-300">
                  This track was saved locally on your phone and hasn't finished syncing to Cloud. Opening the app on that phone will auto-sync it to Cloud.
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-sky-500/20">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                disabled={isUploadingCloud}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md cursor-pointer transition-colors shadow-xs"
              >
                {isUploadingCloud ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span>{isUploadingCloud ? `Uploading (${uploadProgress}%)...` : 'Upload / Attach MP3 Here'}</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRetrySync();
                }}
                disabled={isCheckingSync || isUploadingCloud}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-md cursor-pointer transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${isCheckingSync ? 'animate-spin' : ''}`} />
                <span>Check Cloud Sync</span>
              </button>
            </div>
          </div>
        ) : audioError ? (
          /* General error notice */
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-rose-500 dark:text-rose-400 pt-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{audioError}</span>
            </div>
            {isWebUrl && audioUrl && (
              <button
                type="button"
                onClick={handleOpenExternal}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 underline cursor-pointer shrink-0"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Open Link</span>
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
