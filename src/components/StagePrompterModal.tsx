import { useBackLayer } from '../hooks/useBackLayer';
import { useLyricsScreenAwake } from './LyricsScreenAwake';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Song } from '../types';
import {
  X,
  Maximize2,
  Minimize2,
  Repeat2,
  Music,
  ArrowLeft,
  AlignCenter,
  AlignLeft,
} from 'lucide-react';

interface StagePrompterModalProps {
  userId?: string;
  isOpen: boolean;
  onClose: () => void;
  song: Song | null;
}

const FONT_SIZES = [
  { label: 'Normal', size: '18px', cssClass: 'text-[18px] leading-[1.6]' },
  { label: 'Medium', size: '22px', cssClass: 'text-[22px] leading-[1.6]' },
  { label: 'Large', size: '28px', cssClass: 'text-[28px] leading-[1.55]' },
  { label: 'Stage', size: '36px', cssClass: 'text-[36px] leading-[1.5]' },
  { label: 'Jumbo', size: '46px', cssClass: 'text-[46px] leading-[1.45]' },
  { label: 'Giant', size: '58px', cssClass: 'text-[58px] leading-[1.4]' },
];
const ALIGNMENT_STORAGE_KEY = 'worship_stage_lyrics_alignment';
const SECTION_COLORS = {
  verse: { text: '', surface: '' },
  chorus: { text: 'text-amber-900 dark:text-amber-300', surface: 'bg-amber-100 border-amber-300 dark:bg-amber-500/20 dark:border-amber-500/40' },
  bridge: { text: 'text-violet-900 dark:text-violet-300', surface: 'bg-violet-100 border-violet-300 dark:bg-violet-500/20 dark:border-violet-500/40' },
  ending: { text: 'text-emerald-900 dark:text-emerald-300', surface: 'bg-emerald-100 border-emerald-300 dark:bg-emerald-500/20 dark:border-emerald-500/40' },
};

interface ParsedSection {
  id: string;
  type: 'section' | 'regular';
  title?: string;
  shortLabel?: string;
  kind?: 'verse' | 'chorus' | 'bridge' | 'ending';
  lines: string[];
}

export const StagePrompterModal: React.FC<StagePrompterModalProps> = ({
  userId,
  isOpen,
  onClose,
  song,
}) => {
  // Persistent Preferences
  const [fontSizeIndex, setFontSizeIndex] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('worship_stage_font_index');
      if (saved !== null) {
        const idx = parseInt(saved, 10);
        if (!isNaN(idx) && idx >= 0 && idx < FONT_SIZES.length) return idx;
      }
    } catch {}
    return 3; // Default to 'Stage' (36px)
  });
  const [lyricsAlignment, setLyricsAlignment] = useState<'left' | 'center'>(() => {
    try {
      if (localStorage.getItem(ALIGNMENT_STORAGE_KEY) === 'center') return 'center';
    } catch {}
    return 'left';
  });
  const toggleLyricsAlignment = () => {
    const next = lyricsAlignment === 'left' ? 'center' : 'left';
    setLyricsAlignment(next);
    try {
      localStorage.setItem(ALIGNMENT_STORAGE_KEY, next);
    } catch {}
  };

  // Keep the screen awake silently while lyrics are open.
  useLyricsScreenAwake(isOpen);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sectionElementsRef = useRef(new Map<string, HTMLElement>());
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [sequenceStep, setSequenceStep] = useState<{ id: string; index: number } | null>(null);
  const preferenceKey = userId && song?.id
    ? `qnlbc.stage.repeat-chorus.${encodeURIComponent(userId)}/${encodeURIComponent(song.id)}`
    : null;
  const [repeatOverride, setRepeatOverride] = useState<{ key: string; enabled: boolean } | null>(null);
  const savedRepeat = useMemo(() => {
    try { return Boolean(preferenceKey && localStorage.getItem(preferenceKey) === 'true'); }
    catch { return false; }
  }, [preferenceKey, isOpen]);
  const [viewportHeight, setViewportHeight] = useState(0);

  // Swipe-back gesture detection & visual states
  const touchStartRef = useRef<{ x: number; y: number; time: number; isEdge: boolean; isIgnored: boolean } | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const [isSwiping, setIsSwiping] = useState<boolean>(false);
  const isExplicitlyTogglingFullscreenRef = useRef<boolean>(false);

  // Unified exit handler: exits native fullscreen (if active) and closes stage view
  const handleExit = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    onClose();
  }, [onClose]);

  // Clean up native fullscreen when unmounting
  useEffect(() => {
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  useBackLayer(isOpen, handleExit);
  useEffect(() => {
    if (!isOpen) { setSwipeOffset(0); setIsSwiping(false); }
  }, [isOpen]);

  // Touch handlers for swipe-back gesture to exit
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) {
      touchStartRef.current = null;
      return;
    }
    const touch = e.touches[0];
    const target = e.target as HTMLElement | null;
    const isInteractive = target?.closest('button') || target?.closest('input') || target?.closest('.no-scrollbar');
    if (isInteractive) {
      touchStartRef.current = null;
      return;
    }

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
      isEdge: touch.clientX <= 75,
      isIgnored: false,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || touchStartRef.current.isIgnored) return;

    const touch = e.touches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;

    // If movement is predominantly vertical (scrolling lyrics up/down), ignore gesture
    if (Math.abs(dy) > Math.abs(dx) * 1.15 && Math.abs(dy) > 10) {
      touchStartRef.current.isIgnored = true;
      setSwipeOffset(0);
      setIsSwiping(false);
      return;
    }

    // If swiping right (backwards gesture)
    if (dx > 10) {
      setIsSwiping(true);
      const visualOffset = Math.min(180, Math.pow(dx, 0.92));
      setSwipeOffset(visualOffset);
    } else {
      setSwipeOffset(0);
      setIsSwiping(false);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || touchStartRef.current.isIgnored) {
      touchStartRef.current = null;
      setSwipeOffset(0);
      setIsSwiping(false);
      return;
    }

    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;
    const isEdge = touchStartRef.current.isEdge;

    touchStartRef.current = null;

    // Criteria to exit:
    // 1. Swiped from left edge with > 35px
    // 2. Swiped anywhere to the right with > 75px and mostly horizontal
    // 3. Fast flick right (dt < 280ms) with > 35px
    const isHorizontal = Math.abs(dy) < Math.abs(dx) * 1.3;
    const shouldExit =
      isHorizontal &&
      ((isEdge && dx > 35) ||
        dx > 75 ||
        (dx > 35 && dt < 280));

    if (shouldExit) {
      handleExit();
    }

    setSwipeOffset(0);
    setIsSwiping(false);
  };

  // Save preferences
  useEffect(() => {
    try {
      localStorage.setItem('worship_stage_font_index', fontSizeIndex.toString());
    } catch {}
  }, [fontSizeIndex]);

  // Native Fullscreen Toggle
  const toggleNativeFullscreen = async () => {
    try {
      isExplicitlyTogglingFullscreenRef.current = true;
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen().catch(() => {});
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn('Fullscreen error:', err);
    } finally {
      setTimeout(() => {
        isExplicitlyTogglingFullscreenRef.current = false;
      }, 400);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFullscreen);
      // When in fullscreen mode, if the user pressed the device back button or swiped back,
      // mobile browsers automatically exit native fullscreen. If this exit was not triggered
      // by the explicit toggle button, treat it as an exit command and dismiss the Stage View too.
      if (!isCurrentlyFullscreen && isOpen && !isExplicitlyTogglingFullscreenRef.current) {
        onClose();
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isOpen, onClose]);

  // Escape closes the lyrics view. Song navigation and auto-scroll are intentionally unavailable.
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleExit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleExit]);

  // Parse lyrics into sections for direct jumping (Chorus, Verse 1, etc.)
  const parsedSections = useMemo((): ParsedSection[] => {
    if (!song?.lyrics?.trim()) return [];

    const rawLines = song.lyrics.split(/\r?\n/);
    const sections: ParsedSection[] = [];
    let currentSection: ParsedSection = {
      id: 'section-0',
      type: 'regular',
      lines: [],
    };

    const sectionRegex = /^\[?\s*(verse\s*\d*|chorus\s*\d*|bridge\s*\d*|intro|outro|pre-chorus|refrain|ending|hook)\s*\]?\s*:?$/i;

    rawLines.forEach((line, lineIdx) => {
      const trimmed = line.trim();
      const match = trimmed.match(sectionRegex);

      if (match) {
        if (currentSection.lines.length > 0 || currentSection.title) {
          sections.push(currentSection);
        }

        const fullTitle = match[1].trim();
        let short = fullTitle;
        if (/pre-chorus/i.test(fullTitle)) short = 'Pre-Ch';
        else if (/chorus/i.test(fullTitle)) short = fullTitle.replace(/chorus/i, 'Ch');
        else if (/verse/i.test(fullTitle)) short = fullTitle.replace(/verse/i, 'V');
        else if (/bridge/i.test(fullTitle)) short = fullTitle.replace(/bridge/i, 'Br');
        else if (/pre-chorus/i.test(fullTitle)) short = 'Pre-Ch';
        else if (/intro/i.test(fullTitle)) short = 'Intro';
        else if (/outro/i.test(fullTitle)) short = 'Outro';

        currentSection = {
          id: `section-${lineIdx}`,
          type: 'section',
          title: fullTitle,
          shortLabel: short,
          kind: /^verse/i.test(fullTitle) ? 'verse'
            : /^(chorus|refrain)/i.test(fullTitle) ? 'chorus'
            : /^bridge/i.test(fullTitle) ? 'bridge'
            : /^(ending|outro)$/i.test(fullTitle) ? 'ending' : undefined,
          lines: [],
        };
      } else {
        currentSection.lines.push(line);
      }
    });

    if (currentSection.lines.length > 0 || currentSection.title) {
      sections.push(currentSection);
    }

    return sections;
  }, [song?.lyrics]);

  const namedSections = parsedSections.filter(section => section.type === 'section');
  const choruses = namedSections.filter(section => section.kind === 'chorus');
  const canRepeat = Boolean(preferenceKey && choruses.length === 1 && namedSections.some(section => section.kind === 'verse'));
  const repeatEnabled = canRepeat && (repeatOverride?.key === preferenceKey ? repeatOverride?.enabled : savedRepeat);
  const sequence = namedSections.flatMap((section, index) =>
    repeatEnabled && (section.kind === 'verse' || section.kind === 'bridge') && namedSections[index + 1]?.kind !== 'chorus'
      ? [section, choruses[0]]
      : [section],
  );
  const currentStep = sequenceStep && sequenceStep.id === activeSectionId && sequence[sequenceStep.index]?.id === activeSectionId
    ? sequenceStep.index
    : sequence.findIndex(section => section.id === activeSectionId);
  const nextSection = sequence[currentStep + 1];
  const showNext = repeatEnabled || choruses.length > 1;
  const toggleRepeatChorus = () => {
    if (!canRepeat || !preferenceKey) return;
    const enabled = !repeatEnabled;
    setRepeatOverride({ key: preferenceKey, enabled });
    setSequenceStep(null);
    try {
      if (enabled) localStorage.setItem(preferenceKey, 'true');
      else localStorage.removeItem(preferenceKey);
    } catch {}
  };

  const jumpToSection = (sectionId: string, step?: number) => {
    const el = sectionElementsRef.current.get(sectionId);
    const container = scrollContainerRef.current;
    if (el && container) {
      const top = container.scrollTop + el.getBoundingClientRect().top - container.getBoundingClientRect().top;
      container.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
      setActiveSectionId(sectionId);
      const index = step ?? (sequence[currentStep + 1]?.id === sectionId ? currentStep + 1
        : sequence[currentStep]?.id === sectionId ? currentStep : sequence.findIndex(section => section.id === sectionId));
      setSequenceStep({ id: sectionId, index });
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!isOpen || !container) return;
    const updateActiveSection = () => {
      const top = container.getBoundingClientRect().top;
      let active = parsedSections.find(section => section.type === 'section')?.id ?? null;
      for (const section of parsedSections) {
        if (section.type !== 'section') continue;
        const element = sectionElementsRef.current.get(section.id);
        if (element && element.getBoundingClientRect().top <= top + 16) active = section.id;
      }
      setActiveSectionId(active);
      setSequenceStep(step => step?.id === active ? step : null);
    };
    const resize = new ResizeObserver(() => {
      setViewportHeight(container.clientHeight);
      updateActiveSection();
    });
    resize.observe(container);
    container.scrollTop = 0;
    setSequenceStep(null);
    setViewportHeight(container.clientHeight);
    updateActiveSection();
    container.addEventListener('scroll', updateActiveSection, { passive: true });
    return () => {
      resize.disconnect();
      container.removeEventListener('scroll', updateActiveSection);
    };
  }, [isOpen, song?.id, parsedSections]);

  if (!isOpen || !song) return null;

  const currentFont = FONT_SIZES[fontSizeIndex];

  // Follow the app's current light/dark theme.
  const themeStyles = {
    bg: 'bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100',
    headerBg: 'bg-white/95 border-slate-200 dark:bg-slate-950/90 dark:border-slate-800',
    sectionBadge: 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/40',
    jumpPill: 'bg-slate-100 text-slate-700 hover:bg-sky-500 hover:text-white border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800',
    btnSecondary: 'bg-slate-100 hover:bg-slate-200 text-slate-900 border-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-white dark:border-slate-800',
  };

  return (
    <div
      id="stage-prompter-overlay"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: swipeOffset > 0 ? `translateX(${swipeOffset}px)` : undefined,
        transition: isSwiping ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      className={`fixed inset-0 z-[100] flex flex-col overflow-hidden select-none transition-colors duration-200 ${themeStyles.bg}`}
    >
      {/* Visual Feedback Indicator when Swiping Back to Exit */}
      {swipeOffset > 15 && (
        <div className="fixed left-4 top-1/2 -translate-y-1/2 z-[120] pointer-events-none flex items-center gap-2 px-3.5 py-2 rounded-full bg-slate-900/90 text-white border border-slate-700 shadow-2xl backdrop-blur-md">
          <ArrowLeft className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-bold">
            {swipeOffset > 65 ? 'Release to Exit' : 'Swipe to Exit'}
          </span>
        </div>
      )}

      {/* TOP HEADER CONTROLS */}
      <header
        className={`px-4 pb-3 pt-[calc(.75rem+var(--app-safe-top))] sm:px-6 border-b backdrop-blur-md flex items-center justify-between gap-2 shrink-0 ${themeStyles.headerBg}`}
      >
        {/* Left: title only */}
        <h1 className="min-w-0 truncate text-base font-black tracking-tight sm:text-xl">{song.title}</h1>

        {/* Right: Stage Sizing & Action Toolbar */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {canRepeat && <button
            type="button"
            onClick={toggleRepeatChorus}
            aria-label="Repeat Chorus"
            aria-pressed={Boolean(repeatEnabled)}
            title="Repeat Chorus"
            className={`grid size-11 place-items-center rounded-xl border cursor-pointer transition-colors ${repeatEnabled ? 'bg-sky-400 text-slate-950 border-sky-400' : themeStyles.btnSecondary}`}
          >
            <Repeat2 className="size-5" aria-hidden="true" />
          </button>}
          <button
            type="button"
            onClick={toggleLyricsAlignment}
            aria-label="Center lyrics"
            aria-pressed={lyricsAlignment === 'center'}
            title={lyricsAlignment === 'center' ? 'Align lyrics left' : 'Center lyrics'}
            className={`grid size-11 place-items-center rounded-xl border cursor-pointer transition-colors ${themeStyles.btnSecondary}`}
          >
            {lyricsAlignment === 'center' ? <AlignCenter className="size-5" aria-hidden="true" /> : <AlignLeft className="size-5" aria-hidden="true" />}
          </button>

          {/* Font Resizing Stepper */}
          <div role="group" aria-label={`Lyrics font size: ${currentFont.label}`} className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setFontSizeIndex((prev) => Math.max(0, prev - 1))}
              disabled={fontSizeIndex <= 0}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition-colors cursor-pointer ${
                fontSizeIndex <= 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-slate-200 dark:hover:bg-slate-800 active:scale-95'
              }`}
              title="Decrease Font Size"
            >
              A-
            </button>
            <button
              type="button"
              onClick={() => setFontSizeIndex((prev) => Math.min(FONT_SIZES.length - 1, prev + 1))}
              disabled={fontSizeIndex >= FONT_SIZES.length - 1}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition-colors cursor-pointer ${
                fontSizeIndex >= FONT_SIZES.length - 1
                  ? 'opacity-30 cursor-not-allowed'
                  : 'hover:bg-slate-200 dark:hover:bg-slate-800 active:scale-95'
              }`}
              title="Increase Font Size"
            >
              A+
            </button>
          </div>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleNativeFullscreen}
            className={`p-2 rounded-xl border text-xs font-semibold hidden sm:flex items-center gap-1 cursor-pointer transition-colors ${themeStyles.btnSecondary}`}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Close Prompter */}
          <button
            type="button"
            onClick={handleExit}
            className="min-h-11 min-w-11 justify-center p-2 sm:px-3 sm:py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1 transition-transform active:scale-95 shadow-md cursor-pointer"
            title="Exit Stage Prompter (Esc)"
          >
            <X className="w-5 h-5" />
            <span className="hidden sm:inline">Exit</span>
          </button>
        </div>
      </header>

      {/* SECTION JUMP PILLS (CHORUS, VERSE 1, BRIDGE) */}
      {parsedSections.some((s) => s.type === 'section') && (
        <nav
          aria-label="Lyrics sections"
          className={`order-3 sm:order-none px-3 sm:px-4 pt-2 pb-[calc(var(--app-safe-bottom,0px)+0.75rem)] sm:pb-2 border-t sm:border-t-0 sm:border-b flex items-center gap-2 shrink-0 ${themeStyles.headerBg}`}
        >
          <span className="hidden sm:block mr-1 shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Jump To:
          </span>
          <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          {namedSections.map((s) => {
            const selected = activeSectionId === s.id;
            const { text, surface } = SECTION_COLORS[s.kind ?? 'verse'];
            const sectionColor = surface ? `${text} ${surface}` : '';
            return (
              <button
                key={s.id}
                type="button"
                aria-label={`Jump to ${s.title}`}
                aria-current={selected ? 'location' : undefined}
                onClick={() => jumpToSection(s.id)}
                className={`min-h-11 min-w-11 flex-1 sm:flex-none px-3 py-2 rounded-xl border text-sm font-bold tracking-wide uppercase whitespace-nowrap transition-colors cursor-pointer shrink-0 ${sectionColor || (selected ? 'bg-sky-400 text-slate-950 border-sky-400' : themeStyles.jumpPill)} ${selected && sectionColor ? 'outline outline-2 -outline-offset-2 outline-current' : ''}`}
              >
                {s.shortLabel || s.title}
              </button>
            );
          })}
          </div>
          {showNext && <button
            type="button"
            aria-label="Next lyrics section"
            disabled={!nextSection}
            onClick={() => { if (nextSection) jumpToSection(nextSection.id, currentStep + 1); }}
            className="min-h-11 shrink-0 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white disabled:opacity-40"
          >
            Next
          </button>}
        </nav>
      )}

      {/* LYRICS STAGE DISPLAY VIEWPORT */}
      <main
        ref={scrollContainerRef}
        className="order-2 sm:order-none min-h-0 flex-1 overflow-y-auto px-6 sm:px-12 md:px-20 lg:px-32 py-8 sm:py-12 select-text"
      >
        {!song.lyrics?.trim() ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-60">
            <Music className="w-16 h-16 mb-4 stroke-1 opacity-50" />
            <h2 className="text-xl font-bold">No Lyrics Available</h2>
          </div>
        ) : (
          <div data-lyrics-alignment={lyricsAlignment} className={`max-w-4xl mx-auto space-y-8 ${lyricsAlignment === 'center' ? 'text-center' : 'text-left'}`}>
            {parsedSections.map((section, index) => {
              const { text, surface } = SECTION_COLORS[section.kind ?? 'verse'];
              return (
              <section
                key={section.id}
                id={section.id}
                ref={element => {
                  if (element) sectionElementsRef.current.set(section.id, element);
                  else sectionElementsRef.current.delete(section.id);
                }}
                style={index === parsedSections.length - 1 ? { minHeight: viewportHeight } : undefined}
                className="space-y-3"
              >
                {section.type === 'section' && section.title && (
                  <div className="pt-2">
                    <span
                      className={`inline-block px-3 py-1 rounded-md text-xs sm:text-sm font-black uppercase tracking-widest border ${surface ? `${text} ${surface}` : themeStyles.sectionBadge}`}
                    >
                      {section.title}
                    </span>
                  </div>
                )}
                <div
                  className={`font-sans whitespace-pre-wrap font-medium tracking-normal transition-all duration-150 ${currentFont.cssClass} ${text}`}
                >
                  {section.lines.join('\n')}
                </div>
              </section>
              );
            })}
          </div>
        )}
      </main>

    </div>
  );
};
