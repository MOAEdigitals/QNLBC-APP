import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Rewind,
  Repeat,
  X,
  Music,
  FileAudio,
  AlertTriangle,
} from 'lucide-react';
import { getAudioFromStorage } from '../utils/audioStorage';
import {
  registerActiveAudio,
  notifyAudioStopped,
  subscribeToActiveAudioChange,
} from '../utils/audioCoordinator';
import { resolveMediaUrl } from '../utils/mediaUtils';

interface InlinePracticeAudioPlayerProps {
  trackId: string;
  url: string;
  trackLabel?: string;
  trackCategory?: 'vocal_part' | 'attachment';
  groupId?: string;
  onClose: () => void;
}

export const InlinePracticeAudioPlayer: React.FC<InlinePracticeAudioPlayerProps> = ({
  trackId,
  url,
  trackLabel,
  trackCategory = 'vocal_part',
  onClose,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLooping, setIsLooping] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Format seconds to mm:ss
  const formatTime = (sec: number) => {
    if (isNaN(sec) || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Resolve audio URL (from memory/IndexedDB if needed, cloud/direct stream)
  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setHasError(false);

    const resolve = async () => {
      let finalUrl = url;
      if (!finalUrl || finalUrl.startsWith('indexeddb:')) {
        const targetId = finalUrl ? finalUrl.replace(/^indexeddb:/, '') : undefined;
        const stored = await getAudioFromStorage(targetId || trackId, trackId);
        if (stored) {
          finalUrl = stored;
        }
      }

      if (isCancelled) return;

      if (!finalUrl) {
        setHasError(true);
        setIsLoading(false);
        return;
      }

      setResolvedUrl(resolveMediaUrl(finalUrl));
      setIsLoading(false);
    };

    resolve();

    return () => {
      isCancelled = true;
    };
  }, [trackId, url]);

  // Manage Audio element lifecycle
  useEffect(() => {
    if (!resolvedUrl) return;

    const audio = new Audio();
    audioRef.current = audio;
    audio.src = resolvedUrl;
    audio.loop = isLooping;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (!audio.loop && audio.duration > 0 && audio.currentTime >= audio.duration - 0.05) {
        setIsPlaying(false);
        setCurrentTime(0);
        audio.currentTime = 0;
        notifyAudioStopped(trackId);
      }
    };

    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const onEnded = () => {
      if (!audio.loop) {
        setIsPlaying(false);
        setCurrentTime(0);
        audio.currentTime = 0;
        notifyAudioStopped(trackId);
      }
    };

    const onPlay = () => {
      setIsPlaying(true);
      registerActiveAudio(trackId, audio, () => setIsPlaying(false));
    };
    const onPause = () => {
      if (!audio.seeking) {
        setIsPlaying(false);
        notifyAudioStopped(trackId);
      }
    };
    const onError = () => {
      setHasError(true);
      setIsPlaying(false);
      notifyAudioStopped(trackId);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);

    // Auto-play when ready
    audio
      .play()
      .then(() => {
        setIsPlaying(true);
        registerActiveAudio(trackId, audio, () => setIsPlaying(false));
      })
      .catch((err) => {
        console.warn('Auto-play hindered by browser:', err);
        setIsPlaying(false);
      });

    return () => {
      try {
        audio.pause();
        audio.src = '';
      } catch (_) {}
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
      audioRef.current = null;
      notifyAudioStopped(trackId);
    };
  }, [resolvedUrl, trackId]);

  // Listen to global coordinator so when another player starts, this one pauses cleanly
  useEffect(() => {
    const unsub = subscribeToActiveAudioChange((activeId) => {
      if (activeId && activeId !== trackId && isPlaying) {
        setIsPlaying(false);
        if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause();
        }
      }
    });
    return () => unsub();
  }, [trackId, isPlaying]);

  // Controls
  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => {
        console.error('Playback error:', err);
      });
    }
  };

  const handleSeek = (newSeconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = newSeconds;
    setCurrentTime(newSeconds);
  };

  const handleSkip = (deltaSeconds: number) => {
    if (!audioRef.current) return;
    const cur = audioRef.current.currentTime;
    const dur = audioRef.current.duration || 0;
    const target = cur + deltaSeconds;
    const nextTime = dur > 0 ? Math.max(0, Math.min(dur, target)) : Math.max(0, target);
    audioRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleReplay = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
    setCurrentTime(0);
    setIsPlaying(true);
  };

  const toggleLoop = () => {
    if (!audioRef.current) return;
    const nextLoop = !isLooping;
    audioRef.current.loop = nextLoop;
    setIsLooping(nextLoop);
  };

  const isVocalPart = trackCategory === 'vocal_part';
  const themeColor = isVocalPart ? 'sky' : 'emerald';

  return (
    <div
      className={`p-4 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200 ${
        isVocalPart ? 'ring-1 ring-sky-500/30' : 'ring-1 ring-emerald-500/30'
      }`}
    >
      {/* Player Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div
            className={`p-1.5 rounded-lg border ${
              isVocalPart
                ? 'bg-sky-500/20 text-sky-400 border-sky-500/30'
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            }`}
          >
            {isVocalPart ? <Music className="w-4 h-4" /> : <FileAudio className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <div
              className={`text-[10px] font-bold uppercase tracking-wider ${
                isVocalPart ? 'text-sky-400' : 'text-emerald-400'
              }`}
            >
              {isVocalPart ? 'Now Playing Vocal Part' : 'Now Playing Rehearsal Track'}
            </div>
            <div className="text-xs font-bold truncate text-white">
              {trackLabel || (isVocalPart ? 'Vocal Stem Track' : 'Track Name')}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
          title="Close Player"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {hasError ? (
        <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Could not load audio track. The file or recording might be missing.</span>
        </div>
      ) : isLoading ? (
        <div className="py-3 text-center text-xs text-slate-400">Loading audio track...</div>
      ) : (
        <>
          {/* Progress Scrubber */}
          <div className="space-y-1">
            <div className="relative flex items-center">
              <input
                type="range"
                min="0"
                max={duration > 0 ? duration : 100}
                step="0.1"
                value={currentTime}
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                className={`w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer focus:outline-none ${
                  isVocalPart ? 'accent-sky-400' : 'accent-emerald-400'
                }`}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono text-slate-400">
              <span>{formatTime(currentTime)}</span>
              <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleReplay}
                className="p-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-200"
                title="Replay from Beginning"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden xs:inline text-[10px]">Replay</span>
              </button>

              <button
                type="button"
                onClick={() => handleSkip(-5)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-200"
                title="Rewind 5 seconds"
              >
                <Rewind className="w-3.5 h-3.5" />
                <span className="text-[11px] font-mono font-bold">-5s</span>
              </button>
            </div>

            {/* Big Play / Pause Button */}
            <button
              type="button"
              onClick={togglePlayPause}
              className={`px-5 sm:px-7 py-2 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer ${
                isPlaying
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  : isVocalPart
                  ? 'bg-sky-600 hover:bg-sky-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-slate-950" />
                  <span>PAUSE</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>PLAY</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleSkip(10)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-200"
                title="Forward 10 seconds"
              >
                <span className="text-[11px] font-mono font-bold">+10s</span>
                <FastForward className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={toggleLoop}
                className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  isLooping
                    ? isVocalPart
                      ? 'bg-sky-500 text-white shadow-xs'
                      : 'bg-emerald-500 text-white shadow-xs'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'
                }`}
                title={isLooping ? 'Repeat Loop ON' : 'Repeat Loop OFF'}
              >
                <Repeat className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[10px]">{isLooping ? 'Loop' : 'Repeat'}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
