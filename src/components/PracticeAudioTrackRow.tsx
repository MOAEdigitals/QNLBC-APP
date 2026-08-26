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
  FileAudio,
  Volume2,
  AlertCircle,
} from 'lucide-react';
import { getAudioFromStorage } from '../utils/audioStorage';

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
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  const [resolvedAudioSrc, setResolvedAudioSrc] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

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

  // Convert Google Drive / Dropbox link to streamable direct URL
  const sanitizeAudioUrl = (raw: string): string => {
    if (!raw) return '';
    const trimmed = raw.trim();
    if (trimmed.includes('drive.google.com')) {
      const match = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return `https://drive.google.com/uc?export=download&id=${match[1]}`;
      }
    }
    if (trimmed.includes('dropbox.com')) {
      return trimmed.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');
    }
    return trimmed;
  };

  // Resolve audio source (checking memory cache, IndexedDB, or direct URL)
  useEffect(() => {
    let isCancelled = false;
    setAudioError(null);

    const resolveSource = async () => {
      if (!audioUrl || !audioUrl.trim()) {
        // Try to check storage with track ID as fallback
        const stored = await getAudioFromStorage(id);
        if (!isCancelled) {
          if (stored) {
            setResolvedAudioSrc(stored);
          } else {
            setResolvedAudioSrc('');
          }
        }
        return;
      }

      const raw = audioUrl.trim();
      if (raw.startsWith('indexeddb:')) {
        setIsLoadingAudio(true);
        const stored = await getAudioFromStorage(id);
        if (!isCancelled) {
          if (stored) {
            setResolvedAudioSrc(stored);
          } else {
            setResolvedAudioSrc('');
            setAudioError('Saved audio recording not found on this device');
          }
          setIsLoadingAudio(false);
        }
      } else {
        const clean = sanitizeAudioUrl(raw);
        setResolvedAudioSrc(clean);
      }
    };

    resolveSource();

    return () => {
      isCancelled = true;
    };
  }, [id, audioUrl]);

  // Handle HTML Audio element setup
  useEffect(() => {
    if (!resolvedAudioSrc) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
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
      }
      setAudioError(null);
    };

    const handleTimeUpdate = () => {
      if (!isDragging) {
        setCurrentTime(audio.currentTime);
      }
    };

    const handleEnded = () => {
      if (!audio.loop) {
        setCurrentTime(0);
        onPause();
      }
    };

    const handleError = () => {
      console.warn(`Audio loading error for track ${id}`);
      setAudioError('Audio playback failed');
      onPause();
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      try {
        audio.pause();
        audio.src = '';
      } catch (_) {}
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audioRef.current = null;
    };
  }, [resolvedAudioSrc]);

  // Sync Loop state to audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.loop = isLooping;
    }
  }, [isLooping]);

  // Sync isCurrentlyPlaying prop to HTML Audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isCurrentlyPlaying) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Playback prevented or interrupted:', err);
          onPause();
        });
      }
    } else {
      if (!audio.paused) {
        audio.pause();
      }
    }
  }, [isCurrentlyPlaying, onPause]);

  // Handle Play/Pause Toggle Button Click
  const handleTogglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!resolvedAudioSrc) {
      if (onRecordNewAudio) {
        onRecordNewAudio();
      } else {
        onEdit();
      }
      return;
    }

    if (isCurrentlyPlaying) {
      onPause();
    } else {
      onPlay();
    }
  };

  // Seeking via Scrubber bar click or drag
  const handleSeekFromEvent = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | MouseEvent) => {
      if (!progressBarRef.current || duration <= 0) return;
      const rect = progressBarRef.current.getBoundingClientRect();
      const clientX = 'clientX' in e ? e.clientX : 0;
      const clickX = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const percentage = clickX / rect.width;
      const newTime = percentage * duration;
      setCurrentTime(newTime);
      if (audioRef.current) {
        audioRef.current.currentTime = newTime;
      }
    },
    [duration]
  );

  const handleProgressBarMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (duration <= 0) return;
    setIsDragging(true);
    handleSeekFromEvent(e);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      handleSeekFromEvent(moveEvent);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Download Audio Action
  const handleDownloadAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    if (!resolvedAudioSrc) return;

    try {
      const a = document.createElement('a');
      a.href = resolvedAudioSrc;
      a.download = `${badgeLabel.toLowerCase()}_${performerName.toLowerCase().replace(/\s+/g, '_') || 'audio'}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const hasAudioSource = Boolean(resolvedAudioSrc);

  return (
    <div
      id={`practice-audio-track-${id}`}
      className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 sm:p-5 transition-all hover:border-slate-300 dark:hover:border-slate-700"
    >
      {/* Top Row: [🎵 BADGE] PERFORMER NAME ............. [▶ PLAY] [⋮] */}
      <div className="flex items-center justify-between gap-3 min-w-0">
        {/* Left Side: Badge + Performer Name */}
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          {/* Pill Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200/80 dark:border-slate-700 shrink-0 select-none">
            <Music className="w-3.5 h-3.5 text-slate-800 dark:text-slate-200" />
            <span className="text-xs font-black uppercase tracking-wider">{badgeLabel}</span>
          </div>

          {/* Performer / Assigned Name */}
          <div className="min-w-0 flex-1">
            <h4 className="text-base sm:text-lg font-black tracking-wide text-slate-900 dark:text-white uppercase truncate">
              {performerName || 'UNASSIGNED'}
            </h4>
          </div>
        </div>

        {/* Right Side: Circular Play Button & 3-Dots Menu */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          {/* Play / Pause Circular Button */}
          <button
            type="button"
            id={`play-btn-${id}`}
            onClick={handleTogglePlay}
            aria-label={isCurrentlyPlaying ? 'Pause Audio' : 'Play Audio'}
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer shadow-md hover:scale-105 active:scale-95 ${
              isCurrentlyPlaying
                ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                : hasAudioSource
                ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-100'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-rose-600 hover:text-white'
            }`}
            title={
              hasAudioSource
                ? isCurrentlyPlaying
                  ? 'Pause Audio'
                  : 'Play Audio'
                : 'No audio recorded yet — click to record'
            }
          >
            {isCurrentlyPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : hasAudioSource ? (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            ) : (
              <Mic className="w-4 h-4" />
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
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {/* Dropdown Popover */}
            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl py-1.5 z-30 animate-in fade-in zoom-in-95 duration-150">
                {onRecordNewAudio && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                      onRecordNewAudio();
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Mic className="w-4 h-4 text-rose-500" />
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
                  className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Pencil className="w-4 h-4 text-slate-500" />
                  <span>Edit Details</span>
                </button>

                {hasAudioSource && (
                  <button
                    type="button"
                    onClick={handleDownloadAudio}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Download className="w-4 h-4 text-slate-500" />
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
                  className="w-full px-3.5 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Part</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Scrubber Line + [00:30] ................ [00:56] [🔁] */}
      <div className="mt-4 pt-1 space-y-1.5">
        {/* Interactive Scrubber Track Bar */}
        <div
          ref={progressBarRef}
          onMouseDown={handleProgressBarMouseDown}
          className="relative w-full h-4 flex items-center cursor-pointer group py-1"
          role="slider"
          aria-valuenow={currentTime}
          aria-valuemin={0}
          aria-valuemax={duration}
          tabIndex={0}
        >
          {/* Background Track Line */}
          <div className="w-full h-1 bg-slate-950 dark:bg-slate-600 rounded-full relative overflow-visible">
            {/* Played Progress Line */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-emerald-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
            {/* Green Circular Thumb Dot Indicator (matching the image) */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900 shadow-sm transition-transform group-hover:scale-125"
              style={{ left: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Elapsed Time & Repeat Loop Button */}
        <div className="flex items-center justify-between text-xs font-mono text-slate-800 dark:text-slate-200 select-none">
          {/* Current Elapsed Time (e.g. 00:30) */}
          <span className="font-bold text-xs tracking-wider">
            {formatTime(currentTime)}
          </span>

          {/* Right Side: Loop / Repeat Icon Button */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              id={`loop-btn-${id}`}
              onClick={(e) => {
                e.stopPropagation();
                setIsLooping(!isLooping);
              }}
              aria-label={isLooping ? 'Repeat loop enabled' : 'Repeat loop disabled'}
              className={`p-1 rounded-md transition-colors cursor-pointer flex items-center justify-center ${
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

        {/* Notice if error or no audio */}
        {audioError && (
          <div className="flex items-center gap-1.5 text-[11px] text-rose-500 dark:text-rose-400 pt-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{audioError}</span>
          </div>
        )}
      </div>
    </div>
  );
};
