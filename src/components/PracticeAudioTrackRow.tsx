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
} from 'lucide-react';
import { getAudioFromStorage } from '../utils/audioStorage';
import {
  registerActiveAudio,
  notifyAudioStopped,
  subscribeToActiveAudioChange,
} from '../utils/audioCoordinator';
import { resolveMediaUrl } from '../utils/mediaUtils';

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
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [, setIsDragging] = useState<boolean>(false);

  const isWebUrl = Boolean(
    audioUrl && (audioUrl.startsWith('http://') || audioUrl.startsWith('https://'))
  );

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
        const stored = await getAudioFromStorage(id);
        if (!isCancelled) {
          if (stored) {
            setResolvedAudioSrc(stored);
          } else {
            setResolvedAudioSrc('');
            setAudioError('Saved audio recording not found on this device');
          }
        }
      } else {
        const clean = resolveMediaUrl(raw);
        setResolvedAudioSrc(clean);
      }
    };

    resolveSource();

    return () => {
      isCancelled = true;
    };
  }, [id, audioUrl]);

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
    return () => unsub();
  }, [id, isCurrentlyPlaying, onPause]);

  // Sync isCurrentlyPlaying prop to HTML Audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isCurrentlyPlaying) {
      registerActiveAudio(id, audio, onPause);
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
      notifyAudioStopped(id);
    }
  }, [isCurrentlyPlaying, id, onPause]);

  // Open external audio URL in new tab if needed
  const handleOpenExternal = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (audioUrl) {
      window.open(audioUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Handle Play/Pause Toggle Button Click
  const handleTogglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioError && isWebUrl && audioUrl) {
      handleOpenExternal();
      return;
    }

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

  // Seeking via Scrubber bar click or drag - calculates exact position and updates audio
  const handleSeekFromEvent = useCallback(
    (clientX: number) => {
      if (!progressBarRef.current || duration <= 0) return;
      const rect = progressBarRef.current.getBoundingClientRect();
      const clickX = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const percentage = clickX / rect.width;
      const newTime = Math.max(0, Math.min(duration, percentage * duration));
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
    isDraggingRef.current = true;
    handleSeekFromEvent(e.clientX);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      handleSeekFromEvent(moveEvent.clientX);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleProgressBarTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (duration <= 0 || !e.touches[0]) return;
    setIsDragging(true);
    isDraggingRef.current = true;
    handleSeekFromEvent(e.touches[0].clientX);

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches[0]) {
        handleSeekFromEvent(moveEvent.touches[0].clientX);
      }
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      isDraggingRef.current = false;
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };

    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
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
      className="w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs px-3.5 py-2.5 sm:px-4 sm:py-3 transition-all hover:border-slate-300 dark:hover:border-slate-700"
    >
      {/* Top Row: [🎵 BADGE] PERFORMER NAME ............. [▶ PLAY] [⋮] */}
      <div className="flex items-center justify-between gap-2.5 min-w-0">
        {/* Left Side: Badge + Performer Name */}
        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
          {/* Pill Badge */}
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200/80 dark:border-slate-700 shrink-0 select-none">
            <Music className="w-3 h-3 text-slate-800 dark:text-slate-200" />
            <span className="text-[11px] font-black uppercase tracking-wider">{badgeLabel}</span>
          </div>

          {/* Performer / Assigned Name */}
          <div className="min-w-0 flex-1">
            <h4 className="text-sm sm:text-base font-black tracking-wide text-slate-900 dark:text-white uppercase truncate">
              {performerName || 'UNASSIGNED'}
            </h4>
            {subtitle && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate -mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right Side: Circular Play Button & 3-Dots Menu */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          {/* Play / Pause Circular Button */}
          <button
            type="button"
            id={`play-btn-${id}`}
            onClick={handleTogglePlay}
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
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl py-1.5 z-30 animate-in fade-in zoom-in-95 duration-150">
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

        {/* Notice if error or no audio */}
        {audioError && (
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
        )}
      </div>
    </div>
  );
};
