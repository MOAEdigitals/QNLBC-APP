import { pickerPlacement } from '../utils/pickerPlacement';
import { useBackLayer } from '../hooks/useBackLayer';
import React, { useState, useRef, useEffect, useMemo, useDeferredValue } from 'react';
import { createPortal } from 'react-dom';
import { compareTracksFirst } from '../utils/songTracks';
import { Song, Setlist } from '../types';
import {
  fuzzyMatchString,
  searchSong,
  getSongUsageHistoryFromMap,
  buildSongUsageMap,
  SongUsageHistory,
} from '../utils/songSearch';
import { AlertTriangle, CornerDownLeft, Star, X, ArrowUpDown, ChevronDown, Check } from 'lucide-react';

export type SongPickerFilter = 'all' | 'starred' | 'Hymn' | 'Special' | 'Contemporary' | 'Choir' | 'Tagalog' | 'uncategorized';

const SONG_PICKER_SORTS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'az', label: 'Title: A–Z' },
  { value: 'za', label: 'Title: Z–A' },
  { value: 'tracks-first', label: 'Attached tracks first' },
  { value: 'recently-sung', label: 'Recently Sung' },
  { value: 'least-recently-sung', label: 'Not Sung Recently' },
  { value: 'recently-added', label: 'Recently Added' },
] as const;
type SongPickerSort = typeof SONG_PICKER_SORTS[number]['value'];

const SONG_PICKER_FILTERS: Array<{ value: SongPickerFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'starred', label: 'Starred' },
  { value: 'Hymn', label: 'Hymn' },
  { value: 'Special', label: 'Special' },
  { value: 'Contemporary', label: 'Contemporary' },
  { value: 'Choir', label: 'Choir' },
  { value: 'Tagalog', label: 'Tagalog' },
  { value: 'uncategorized', label: 'Uncategorized' },
];

function songMatchesPickerFilter(song: Song, filter: SongPickerFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'starred') return Boolean(song.isStarred || (song as Song & { starred?: boolean }).starred);
  const categories = (Array.isArray(song.categories) && song.categories.length > 0
    ? song.categories
    : (song.category || '').split(',')).map(category => category.trim()).filter(Boolean);
  if (filter === 'uncategorized') return categories.length === 0;
  return categories.includes(filter);
}

export interface DisplaySuggestionItem {
  title: string;
  songObj?: Song;
  matchedField?: 'title' | 'artist' | 'lyrics' | 'none';
  lyricSnippet?: string;
  score?: number;
  history?: SongUsageHistory;
}

interface AutofillInputProps {
  value: string;
  onChange: (val: string) => void;
  suggestions?: string[]; // Primary suggestions (e.g. marked welcome/closing/theme songs or song titles)
  allSuggestions?: string[]; // Fallback full library suggestions when user types
  defaultValue?: string; // Default song (e.g. 'Napakaligaya' or 'Give Thanks')
  songs?: Song[]; // Full song library for lyrics search and metadata
  selectedSongTitles?: string[]; // Songs currently used in the draft setlist, across sections
  setlists?: Setlist[]; // Setlists for last-sung history
  showLastSung?: boolean; // Defaults to true; set to false for Welcome Song, Closing Song, and Theme Song
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  required?: boolean;
  type?: string;
  onSelectSuggestion?: (val: string) => void;
  id?: string;
  showAllOnFocus?: boolean;
  name?: string;
  autoComplete?: string;
  showSongCategoryFilters?: boolean;
  songFilter?: SongPickerFilter;
  onSongFilterChange?: (filter: SongPickerFilter) => void;
}

const AutofillInputComponent: React.FC<AutofillInputProps> = ({
  value,
  onChange,
  suggestions = [],
  allSuggestions,
  defaultValue,
  songs,
  selectedSongTitles = [],
  setlists,
  showLastSung = true,
  placeholder,
  className = '',
  inputClassName = '',
  required = false,
  type = 'search',
  onSelectSuggestion,
  id,
  name,
  autoComplete = 'off',
  showAllOnFocus = false,
  showSongCategoryFilters: categoryFiltersRequested = false,
  songFilter: controlledSongFilter,
  onSongFilterChange: onControlledFilterChange,
}) => {
  const showSongCategoryFilters = categoryFiltersRequested || songs !== undefined;
  const selectedTitles = useMemo(() => new Set(selectedSongTitles.map(title => title.trim().toLowerCase()).filter(Boolean)), [selectedSongTitles]);
  const [localSongFilter, setLocalSongFilter] = useState<SongPickerFilter>('all');
  const songFilter = controlledSongFilter ?? localSongFilter;
  const onSongFilterChange = (filter: SongPickerFilter) => {
    setLocalSongFilter(filter);
    onControlledFilterChange?.(filter);
  };
  const [songSort, setSongSort] = useState<SongPickerSort>('relevance');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const sortButtonRef = useRef<HTMLButtonElement>(null);
  const sortLabel = SONG_PICKER_SORTS.find(option => option.value === songSort)!.label;
  const sortControl = <div ref={sortMenuRef} className="relative shrink-0 py-1.5" onKeyDown={event => {
    if (event.key === 'Escape' && isSortMenuOpen) { event.stopPropagation(); setIsSortMenuOpen(false); sortButtonRef.current?.focus(); }
    if (isSortMenuOpen && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      const options = Array.from(sortMenuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') || []);
      const current = options.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (current + (event.key === 'ArrowUp' ? -1 : 1) + options.length) % options.length;
      options[next]?.focus();
    }
  }}>
    <button ref={sortButtonRef} type="button" aria-label={`Sort songs: ${sortLabel}`} aria-haspopup="menu" aria-expanded={isSortMenuOpen}
      onClick={() => setIsSortMenuOpen(open => !open)}
      onKeyDown={event => { if (!isSortMenuOpen && ['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); setIsSortMenuOpen(true); } }}
      className="h-8 max-w-[158px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 flex items-center gap-1.5 text-xs font-semibold shadow-xs">
      <ArrowUpDown className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{sortLabel}</span>
      <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${isSortMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
    </button>
    {isSortMenuOpen && <div role="menu" aria-label="Song sorting" className="absolute right-0 top-full mt-1.5 z-40 w-52 max-h-[min(18rem,35dvh)] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 shadow-xl">
      {SONG_PICKER_SORTS.map(option => <button key={option.value} type="button" role="menuitemradio" aria-checked={songSort === option.value}
        onClick={() => { setSongSort(option.value); setHighlightedIndex(-1); setIsSortMenuOpen(false); sortButtonRef.current?.focus({ preventScroll: true }); }}
        className={`w-full px-3 py-2 rounded-lg flex items-center justify-between gap-3 text-left text-sm transition-colors ${songSort === option.value ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
        <span>{option.label}</span>{songSort === option.value && <Check className="w-4 h-4 shrink-0" />}
      </button>)}
    </div>}
  </div>;
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => { if (!isOpen) setIsSortMenuOpen(false); }, [isOpen]);
  useEffect(() => {
    if (!isSortMenuOpen) return;
    sortMenuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus({ preventScroll: true });
    const closeSortMenu = (event: PointerEvent) => { if (!sortMenuRef.current?.contains(event.target as Node)) setIsSortMenuOpen(false); };
    document.addEventListener('pointerdown', closeSortMenu);
    return () => document.removeEventListener('pointerdown', closeSortMenu);
  }, [isSortMenuOpen]);
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isTouchPicker, setIsTouchPicker] = useState(false);
  const [isBrowseOnly, setIsBrowseOnly] = useState(true);
  const [pickerQuery, setPickerQuery] = useState('');
  const [desktopBrowsing, setDesktopBrowsing] = useState(false);
  const [isPickerFullscreen, setIsPickerFullscreen] = useState(false);
  const [pickerDragY, setPickerDragY] = useState(0);
  const [isPickerDragging, setIsPickerDragging] = useState(false);
  const [pickerCloseMs, setPickerCloseMs] = useState(240);
  const closeDurationRef = useRef(240);
  const pickerListRef = useRef<HTMLDivElement>(null);
  const pickerDragRef = useRef<{ pointerId: number; x: number; y: number; lastY: number; lastTime: number; velocity: number } | null>(null);
  const ignoreHandleClickRef = useRef(false);
  const pickerSearchRef = useRef<HTMLInputElement>(null);
  const [isPickerClosing, setIsPickerClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishClosePicker = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
    setIsOpen(false);
    setIsFocused(false);
    setIsBrowseOnly(true);
    setIsPickerFullscreen(false);
    setPickerDragY(0);
    setIsPickerClosing(false);
    pickerDragRef.current = null;
    setIsPickerDragging(false);
  };
  const closePicker = () => {
    if (closeTimerRef.current) return;
    pickerSearchRef.current?.blur();
    pickerDragRef.current = null;
    setIsPickerDragging(false);
    const duration = closeDurationRef.current;
    closeDurationRef.current = 240;
    setPickerCloseMs(duration);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      finishClosePicker();
      return;
    }
    // Keep the sheet mounted at its current height while it slides below the viewport.
    setIsPickerClosing(true);
    closeTimerRef.current = setTimeout(finishClosePicker, duration + 20);
  };
  useBackLayer(isOpen && isTouchPicker, () => { setPickerQuery(''); closePicker(); });
  useEffect(() => {
    if (!isOpen) {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
      setIsPickerClosing(false);
    }
    return () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); };
  }, [isOpen]);
  const [mobilePickerPosition, setMobilePickerPosition] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputTouchStartRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const ignoreTouchClickRef = useRef(false);
  const instanceIdRef = useRef(`autofill-${Math.random().toString(36).slice(2, 10)}`);
  const stableInputIdRef = useRef(id || `field-input-${Math.random().toString(36).slice(2, 9)}`);

  // Touch gesture and scroll tracking refs so mobile scrolling never triggers accidental selection
  const touchStartPosRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isScrollingRef = useRef<boolean>(false);
  const hasMovedRef = useRef<boolean>(false);
  const lastScrollTimeRef = useRef<number>(0);
  const rowGestureRef = useRef<{ id: number; title: string; x: number; y: number; moved: boolean; scrollTop: number } | null>(null);
  const handledRowRef = useRef<{ title: string; at: number } | null>(null);
  const scrollTimeoutRef = useRef<any>(null);

  const releasePickerPull = (distance: number, velocity: number) => {
    setIsPickerDragging(false);
    // A deliberate pull closes; a short flick needs downward momentum.
    // Reversing upward or pausing after a small pull returns the sheet to its place.
    if (velocity >= 0 && (distance >= 80 || (distance >= 24 && velocity >= 0.55))) {
      const height = dropdownRef.current?.getBoundingClientRect().height || mobilePickerPosition?.maxHeight || 560;
      const remaining = Math.max(0, height - distance);
      closeDurationRef.current = Math.round(Math.max(100, Math.min(240, remaining / Math.max(velocity, 0.6))));
      closePicker();
    } else {
      setPickerDragY(0);
    }
  };

  useEffect(() => {
    const list = pickerListRef.current;
    if (!isOpen || !isTouchPicker || isPickerClosing || !list) return;
    let pull: { x: number; y: number; lastY: number; lastTime: number; velocity: number; dragging: boolean; rejected: boolean } | null = null;
    const cancel = () => {
      if (pull?.dragging) { setIsPickerDragging(false); setPickerDragY(0); }
      pull = null;
    };
    const start = (event: TouchEvent) => {
      cancel();
      if (event.touches.length !== 1 || list.scrollTop > 2) return;
      const touch = event.touches[0];
      pull = { x: touch.clientX, y: touch.clientY, lastY: touch.clientY, lastTime: event.timeStamp, velocity: 0, dragging: false, rejected: false };
    };
    const move = (event: TouchEvent) => {
      if (!pull || pull.rejected) return;
      if (event.touches.length !== 1) { cancel(); return; }
      const touch = event.touches[0];
      const dy = touch.clientY - pull.y;
      const dx = Math.abs(touch.clientX - pull.x);
      if (!pull.dragging) {
        if (Math.max(Math.abs(dy), dx) <= 8) return;
        if (dy <= 0 || dy <= dx * 1.5 || !event.cancelable) { pull.rejected = true; return; }
        pull.dragging = true;
        setIsPickerDragging(true);
      }
      // A non-passive listener lets the sheet own this downward pull while
      // all other gestures retain normal native list scrolling.
      if (event.cancelable) event.preventDefault();
      const elapsed = Math.max(1, event.timeStamp - pull.lastTime);
      pull.velocity = (touch.clientY - pull.lastY) / elapsed;
      pull.lastY = touch.clientY;
      pull.lastTime = event.timeStamp;
      lastScrollTimeRef.current = Date.now();
      hasMovedRef.current = true;
      setPickerDragY(Math.max(0, dy));
    };
    const end = (event: TouchEvent) => {
      const gesture = pull;
      if (!gesture?.dragging) { pull = null; return; }
      if (event.touches.length || event.changedTouches.length !== 1) { cancel(); return; }
      pull = null;
      const distance = Math.max(0, event.changedTouches[0].clientY - gesture.y);
      const velocity = event.timeStamp - gesture.lastTime > 100 ? 0 : gesture.velocity;
      lastScrollTimeRef.current = Date.now();
      releasePickerPull(distance, velocity);
    };
    list.addEventListener('touchstart', start, { passive: true });
    list.addEventListener('touchmove', move, { passive: false });
    list.addEventListener('touchend', end);
    list.addEventListener('touchcancel', cancel);
    return () => {
      list.removeEventListener('touchstart', start);
      list.removeEventListener('touchmove', move);
      list.removeEventListener('touchend', end);
      list.removeEventListener('touchcancel', cancel);
      cancel();
    };
  }, [isOpen, isTouchPicker, isPickerClosing, mobilePickerPosition]);


  const positionMobilePicker = (_ensureSpace = false) => {
    const input = inputRef.current;
    if (!input) return;

    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop || 0;
    const viewportHeight = viewport?.height || window.innerHeight;
    const viewportBottom = viewportTop + viewportHeight;
    const desiredHeight = Math.min(360, Math.max(240, viewportHeight * 0.48));
    const rect = input.getBoundingClientRect();
    const form = input.closest('form');
    const formRect = form?.getBoundingClientRect();
    const body = input.closest('.ui-form-body');
    const bodyRect = body?.getBoundingClientRect();
    let usableTop = Math.max(viewportTop + 12, formRect?.top ?? viewportTop, bodyRect?.top ?? viewportTop);
    let usableBottom = Math.min(viewportBottom - 12, formRect?.bottom ?? viewportBottom, bodyRect?.bottom ?? viewportBottom);
    // Use the same action containers as the shared form styling.
    form?.querySelectorAll('.ui-form-actions, :scope > footer, :scope > div:last-child, :scope > fieldset > div:last-child').forEach(footer => {
      if (!footer.querySelector('button[type="submit"]')) return;
      const bounds = footer.getBoundingClientRect();
      if (bounds.height > 0 && bounds.top < usableBottom && bounds.bottom > usableTop) usableBottom = Math.max(usableTop, bounds.top - 6);
    });
    usableTop = Math.min(usableTop, usableBottom);
    // A field scrolled behind the header/actions must not leave its picker floating over them.
    if (rect.bottom <= usableTop || rect.top >= usableBottom) {
      setMobilePickerPosition({ top: usableTop, left: rect.left, width: rect.width, maxHeight: 0 });
      return;
    }
    const { top, maxHeight } = pickerPlacement(rect, usableTop, usableBottom, desiredHeight);
    setMobilePickerPosition({
      top,
      left: Math.max(12, rect.left),
      width: Math.min(rect.width, window.innerWidth - 24),
      maxHeight,
    });
  };

  const cleanVal = (value || '').trim();
  const lowerVal = cleanVal.toLowerCase();
  const rawQuery = isTouchPicker ? pickerQuery.trim().toLowerCase() : showAllOnFocus && desktopBrowsing ? '' : lowerVal;
  const activeQuery = useDeferredValue(rawQuery);
  const [browseLimit, setBrowseLimit] = useState(80);
  useEffect(() => { setBrowseLimit(80); }, [activeQuery, songFilter, songSort, isOpen]);
  const cleanDefault = (defaultValue || '').trim().toLowerCase();

  const filteredSongs = useMemo(
    () => (songs || []).filter((song) => !showSongCategoryFilters || songMatchesPickerFilter(song, songFilter as SongPickerFilter)),
    [songs, showSongCategoryFilters, songFilter]
  );

  const filteredSuggestions = useMemo(() => {
    if (!showSongCategoryFilters || songFilter === 'all') return suggestions;
    const allowedTitles = new Set(filteredSongs.map((song) => song.title.toLowerCase().trim()));
    return suggestions.filter((title) => allowedTitles.has(title.toLowerCase().trim()));
  }, [suggestions, filteredSongs, showSongCategoryFilters, songFilter]);

  // Fast O(1) cached usage map reference
  const usageMap = useMemo(() => {
    if (!setlists || setlists.length === 0) return null;
    return buildSongUsageMap(setlists);
  }, [setlists]);

  // Pre-calculate usage history for current value only if setlists provided and value exists
  const currentValueHistory = useMemo(() => {
    if (!usageMap || !cleanVal) return null;
    return getSongUsageHistoryFromMap(cleanVal, usageMap);
  }, [cleanVal, usageMap]);

  // Compute displayed suggestions ONLY when open to keep keyboard typing 100% instantaneous
  const matchedItems: DisplaySuggestionItem[] = useMemo(() => {
    if (!isOpen) return [];

    // Lookup map for Song objects by lowercase title
    const songMap = new Map<string, Song>();
    if (filteredSongs) {
      for (const s of filteredSongs) {
        if (s.title) {
          songMap.set(s.title.toLowerCase().trim(), s);
        }
      }
    }

    const buildItem = (
      title: string,
      matchedField: 'title' | 'artist' | 'lyrics' | 'none' = 'title',
      lyricSnippet?: string,
      score: number = 50
    ): DisplaySuggestionItem => {
      const songObj = songMap.get(title.toLowerCase().trim());
      const history = usageMap ? getSongUsageHistoryFromMap(title, usageMap) : undefined;
      return {
        title,
        songObj,
        matchedField,
        lyricSnippet,
        score,
        history,
      };
    };

    // 1. If empty query OR matching default value
    if (!activeQuery || (cleanDefault && activeQuery === cleanDefault)) {
      if (filteredSuggestions && filteredSuggestions.length > 0) {
        return filteredSuggestions.map((s) => buildItem(s, 'none', undefined, 100));
      }
      if (filteredSongs.length > 0) {
        return filteredSongs.map((s) => buildItem(s.title, 'none', undefined, 100));
      }
      return [];
    }

    // 2. If songs array is available, search across all songs in the library
    if (filteredSongs.length > 0) {
      const scoredResults: DisplaySuggestionItem[] = [];
      const primarySet = new Set(filteredSuggestions.map((t) => t.toLowerCase().trim()));

      for (const s of filteredSongs) {
        const searchRes = searchSong(s, activeQuery);
        if (searchRes.matches) {
          const isPrimary = primarySet.has(s.title.toLowerCase().trim());
          const boostedScore = searchRes.score + (isPrimary ? 15 : 0);
          const history = usageMap ? getSongUsageHistoryFromMap(s.title, usageMap) : undefined;

          scoredResults.push({
            title: s.title,
            songObj: s,
            matchedField: searchRes.matchedField,
            lyricSnippet: searchRes.lyricSnippet,
            score: boostedScore,
            history,
          });
        }
      }

      // Also include any raw suggestions not in the song library that match fuzzy query
      const knownTitles = new Set(scoredResults.map((r) => r.title.toLowerCase().trim()));
      const pool = showSongCategoryFilters
        ? filteredSuggestions
        : allSuggestions && allSuggestions.length > 0 ? allSuggestions : suggestions;
      for (const raw of pool) {
        if (raw && !knownTitles.has(raw.toLowerCase().trim())) {
          const match = fuzzyMatchString(raw, activeQuery);
          if (match.matches) {
            scoredResults.push(buildItem(raw, 'title', undefined, match.score));
          }
        }
      }

      // Sort by score descending
      scoredResults.sort((a, b) => (b.score || 0) - (a.score || 0));
      return scoredResults;
    }

    // 3. Fallback string-based fuzzy search for names or custom string lists
    const pool = showSongCategoryFilters
      ? filteredSuggestions
      : allSuggestions && allSuggestions.length > 0 ? allSuggestions : suggestions;
    const results: DisplaySuggestionItem[] = [];

    for (const title of pool) {
      if (!title) continue;
      const match = fuzzyMatchString(title, activeQuery);
      if (match.matches) {
        const isPrimary = suggestions.includes(title);
        results.push(buildItem(title, 'title', undefined, match.score + (isPrimary ? 10 : 0)));
      }
    }

    results.sort((a, b) => (b.score || 0) - (a.score || 0));
    return results;
  }, [isOpen, activeQuery, cleanDefault, suggestions, filteredSuggestions, allSuggestions, filteredSongs, showSongCategoryFilters, usageMap]);

  const displayedItems = useMemo(() => {
    const ordered = !showSongCategoryFilters || songSort === 'relevance' ? matchedItems : [...matchedItems].sort((a, b) => {
      if (songSort === 'tracks-first') return compareTracksFirst(a.songObj || { id: '', title: a.title, lyrics: '', updatedAt: '' }, b.songObj || { id: '', title: b.title, lyrics: '', updatedAt: '' });
      if (songSort === 'recently-added') return (b.songObj?.createdAt || '').localeCompare(a.songObj?.createdAt || '') || a.title.localeCompare(b.title);
      if (songSort === 'recently-sung' || songSort === 'least-recently-sung') {
        const dateA = a.history?.lastDate || '', dateB = b.history?.lastDate || '';
        return (songSort === 'recently-sung' ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB)) || a.title.localeCompare(b.title);
      }
      return (songSort === 'az' ? 1 : -1) * a.title.localeCompare(b.title);
    });
    return ordered.slice(0, activeQuery ? 30 : browseLimit);
  }, [matchedItems, songSort, showSongCategoryFilters, activeQuery, browseLimit]);

  // Keep exactly one autocomplete picker open across the entire setlist editor.
  useEffect(() => {
    const closeWhenAnotherPickerOpens = (event: Event) => {
      const pickerId = (event as CustomEvent<string>).detail;
      if (pickerId !== instanceIdRef.current) {
        setIsOpen(false);
        setIsFocused(false);
        setIsBrowseOnly(true);
      }
    };
    document.addEventListener('qnlbc-autofill-open', closeWhenAnotherPickerOpens);
    return () => document.removeEventListener('qnlbc-autofill-open', closeWhenAnotherPickerOpens);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.dispatchEvent(new CustomEvent('qnlbc-autofill-open', { detail: instanceIdRef.current }));
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (isTouchPicker) {
      // A viewport sheet never flips above/below the field as the keyboard changes size.
      const repositionSheet = () => {
        const viewport = window.visualViewport;
        setMobilePickerPosition({ top: viewport?.offsetTop || 0, left: 0, width: window.innerWidth, maxHeight: viewport?.height || window.innerHeight });
      };
      const body = inputRef.current?.closest<HTMLElement>('.ui-form-body');
      const scrollTop = body?.scrollTop;
      const previousOverflow = body?.style.overflow;
      if (body) body.style.overflow = 'hidden';
      repositionSheet();
      dropdownRef.current?.querySelector<HTMLButtonElement>('[aria-label="Close picker"]')?.focus({ preventScroll: true });
      window.addEventListener('resize', repositionSheet);
      window.visualViewport?.addEventListener('resize', repositionSheet);
      window.visualViewport?.addEventListener('scroll', repositionSheet);
      return () => {
        window.removeEventListener('resize', repositionSheet);
        window.visualViewport?.removeEventListener('resize', repositionSheet);
        window.visualViewport?.removeEventListener('scroll', repositionSheet);
        if (body) { body.style.overflow = previousOverflow || ''; body.scrollTop = scrollTop || 0; }
      };
    }
    const reposition = () => positionMobilePicker(false);
    const repositionAfterKeyboard = () => positionMobilePicker(true);
    reposition();
    const observer = new ResizeObserver(reposition);
    const form = inputRef.current?.closest('form');
    if (form) {
      observer.observe(form);
      form.querySelectorAll('.ui-form-body, .ui-form-actions, :scope > footer, :scope > div:last-child, :scope > fieldset > div:last-child').forEach(element => observer.observe(element));
    }
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    window.visualViewport?.addEventListener('resize', repositionAfterKeyboard);
    window.visualViewport?.addEventListener('scroll', reposition);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      window.visualViewport?.removeEventListener('resize', repositionAfterKeyboard);
      window.visualViewport?.removeEventListener('scroll', reposition);
    };
  }, [isOpen, isTouchPicker]);

  // Find exact prefix match for inline autocomplete ghost text only when focused & typing
  const bestPrefixMatch = useMemo(() => {
    if (!isFocused || !lowerVal || lowerVal.length < 2) return undefined;

    // Search fast in suggestions first
    if (filteredSuggestions && filteredSuggestions.length > 0) {
      const match = filteredSuggestions.find(
        (s) => s && s.toLowerCase().startsWith(lowerVal) && s.length > cleanVal.length
      );
      if (match) return match;
    }

    // Search in songs next
    if (filteredSongs.length > 0) {
      const songMatch = filteredSongs.find(
        (s) => s.title && s.title.toLowerCase().startsWith(lowerVal) && s.title.length > cleanVal.length
      );
      if (songMatch) return songMatch.title;
    }

    // Search in allSuggestions
    if (allSuggestions && allSuggestions.length > 0) {
      const allMatch = allSuggestions.find(
        (s) => s && s.toLowerCase().startsWith(lowerVal) && s.length > cleanVal.length
      );
      if (allMatch) return allMatch;
    }

    return undefined;
  }, [isFocused, lowerVal, cleanVal.length, filteredSuggestions, filteredSongs, allSuggestions]);

  const ghostSuffix = bestPrefixMatch
    ? bestPrefixMatch.slice((value || '').length)
    : '';

  // Handle outside clicks/taps cleanly without closing suggestions when scrolling container or page
  useEffect(() => {
    if (!isOpen) return;
    let touchOutsideStart: { x: number; y: number; time: number } | null = null;
    let isTouchMoveOutside = false;

    const handleTouchStartOutside = (event: TouchEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        const touch = event.touches[0];
        touchOutsideStart = { x: touch.clientX, y: touch.clientY, time: Date.now() };
        isTouchMoveOutside = false;
      } else {
        touchOutsideStart = null;
        isTouchMoveOutside = false;
      }
    };

    const handleTouchMoveOutside = (event: TouchEvent) => {
      if (!touchOutsideStart) return;
      const touch = event.touches[0];
      const diffX = Math.abs(touch.clientX - touchOutsideStart.x);
      const diffY = Math.abs(touch.clientY - touchOutsideStart.y);
      if (diffX > 8 || diffY > 8) {
        isTouchMoveOutside = true;
      }
    };

    const handleTouchEndOutside = (event: TouchEvent) => {
      if (touchOutsideStart && !isTouchMoveOutside) {
        // Was an intentional tap outside, not a scroll or swipe gesture
        closePicker();
      }
      touchOutsideStart = null;
      isTouchMoveOutside = false;
    };

    const handleMouseDownOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        closePicker();
      }
    };

    document.addEventListener('mousedown', handleMouseDownOutside);
    document.addEventListener('touchstart', handleTouchStartOutside, { passive: true });
    document.addEventListener('touchmove', handleTouchMoveOutside, { passive: true });
    document.addEventListener('touchend', handleTouchEndOutside, { passive: true });
    const cancelOutsideTouch = () => { touchOutsideStart = null; isTouchMoveOutside = false; };
    document.addEventListener('touchcancel', cancelOutsideTouch, { passive: true });

    return () => {
      document.removeEventListener('mousedown', handleMouseDownOutside);
      document.removeEventListener('touchstart', handleTouchStartOutside);
      document.removeEventListener('touchmove', handleTouchMoveOutside);
      document.removeEventListener('touchend', handleTouchEndOutside);
      document.removeEventListener('touchcancel', cancelOutsideTouch);
    };
  }, [isOpen, isTouchPicker]);

  const handleAcceptPrefix = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (bestPrefixMatch) {
      onChange(bestPrefixMatch);
      onSelectSuggestion?.(bestPrefixMatch);
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const handleSelect = (item: DisplaySuggestionItem, e?: React.SyntheticEvent) => {
    if (closeTimerRef.current) return;
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    onChange(item.title);
    onSelectSuggestion?.(item.title);
    closePicker();
    setHighlightedIndex(-1);
  };

  // Pointer taps are committed on release before keyboard/viewport movement.
  // Keep click as the keyboard and legacy-browser fallback only.
  const handleItemClick = (item: DisplaySuggestionItem, e?: React.MouseEvent) => {
    if (e?.detail === 0) { handleSelect(item, e); return; }
    if (handledRowRef.current?.title === item.title && Date.now() - handledRowRef.current.at < 1000) return;
    if (
      isScrollingRef.current ||
      hasMovedRef.current ||
      Date.now() - lastScrollTimeRef.current < 320
    ) {
      return;
    }
    handleSelect(item, e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      if (displayedItems.length > 0) {
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex((prev) =>
          prev < displayedItems.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === 'ArrowUp') {
      if (displayedItems.length > 0) {
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : displayedItems.length - 1
        );
      }
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && displayedItems[highlightedIndex]) {
        e.preventDefault();
        e.stopPropagation();
        const selected = displayedItems[highlightedIndex].title;
        onChange(selected);
        onSelectSuggestion?.(selected);
        setIsOpen(false);
        setHighlightedIndex(-1);
      } else if (bestPrefixMatch) {
        e.preventDefault();
        e.stopPropagation();
        onChange(bestPrefixMatch);
        onSelectSuggestion?.(bestPrefixMatch);
        setIsOpen(false);
      } else if (displayedItems.length > 0 && isOpen) {
        e.preventDefault();
        e.stopPropagation();
        const selected = displayedItems[0].title;
        onChange(selected);
        onSelectSuggestion?.(selected);
        setIsOpen(false);
      }
    } else if (e.key === 'Tab') {
      if (bestPrefixMatch) {
        e.preventDefault();
        onChange(bestPrefixMatch);
        onSelectSuggestion?.(bestPrefixMatch);
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Ghost text display overlay behind input with clickable fill badge */}
      {bestPrefixMatch && isFocused && !isTouchPicker && (
        <div
          onClick={handleAcceptPrefix}
          className="absolute inset-0 flex items-center px-3 py-2 text-sm select-none overflow-hidden pr-2 cursor-pointer pointer-events-none"
          style={isOpen && !isTouchPicker && showSongCategoryFilters ? { paddingRight: 170 } : undefined}
        >
          <span className="opacity-0 whitespace-pre">{value}</span>
          <span className="text-slate-400/80 dark:text-slate-500 font-medium whitespace-pre">
            {ghostSuffix}
          </span>
          <button
            type="button"
            onMouseDown={handleAcceptPrefix}
            onTouchEnd={handleAcceptPrefix}
            onClick={handleAcceptPrefix}
            className="pointer-events-auto ml-auto shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-950/80 hover:bg-sky-200 dark:hover:bg-sky-900 px-2 py-0.5 rounded-md border border-sky-300 dark:border-sky-700 shadow-xs active:scale-95 transition-all cursor-pointer z-10"
            title="Tap or press Enter to fill"
          >
            <CornerDownLeft className="w-3 h-3" />
            <span>Fill</span>
          </button>
        </div>
      )}

      <div className="relative flex items-center w-full">
        {isOpen && !isTouchPicker && showSongCategoryFilters && <div className="absolute right-0 z-[210] text-slate-500 dark:text-slate-400">{sortControl}</div>}
        <input
          ref={inputRef}
          id={stableInputIdRef.current}
          name={name || "search_field_query"}
          type={type}
          autoComplete={autoComplete}
          autoCorrect="off"
          autoCapitalize="sentences"
          spellCheck={false}
          data-form-type="other"
          data-lpignore="true"
          required={required}
          readOnly={isTouchPicker}
          value={value}
          onPointerDown={(event) => {
            if (event.pointerType !== 'touch') { setIsTouchPicker(false); return; }
            event.preventDefault();
            setIsTouchPicker(true);
            inputRef.current?.blur();
            inputTouchStartRef.current = {
              x: event.clientX,
              y: event.clientY,
              moved: false,
            };
          }}
          onPointerMove={(event) => {
            if (event.pointerType !== 'touch' || !inputTouchStartRef.current) return;
            const start = inputTouchStartRef.current;
            if (Math.abs(event.clientX - start.x) > 8 || Math.abs(event.clientY - start.y) > 8) {
              start.moved = true;
            }
          }}
          onPointerCancel={(event) => {
            if (event.pointerType !== 'touch') return;
            inputTouchStartRef.current = null;
            ignoreTouchClickRef.current = true;
            window.setTimeout(() => {
              ignoreTouchClickRef.current = false;
            }, 0);
          }}
          onPointerUp={(event) => {
            if (event.pointerType !== 'touch') return;
            event.preventDefault();
            ignoreTouchClickRef.current = true;
            window.setTimeout(() => {
              ignoreTouchClickRef.current = false;
            }, 0);
            const touch = inputTouchStartRef.current;
            inputTouchStartRef.current = null;
            if (!touch || touch.moved) return;

            if (!isOpen) {
              // A completed stationary tap browses; touching the field while scrolling does nothing.
              setIsFocused(false);
              setIsBrowseOnly(true);
              setPickerQuery('');
              if (showAllOnFocus) onSongFilterChange('all');
              setIsPickerFullscreen(false);
              setPickerDragY(0);
              setMobilePickerPosition(null);
              setIsOpen(true);
              setHighlightedIndex(-1);
              return;
            }
          }}
          onChange={(e) => {
            setDesktopBrowsing(false);
            onChange(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => {
            if (showAllOnFocus) { setDesktopBrowsing(true); onSongFilterChange('all'); }
            setIsFocused(true);
            setIsOpen(true);
          }}
          onClick={() => {
            if (ignoreTouchClickRef.current) {
              ignoreTouchClickRef.current = false;
              return;
            }
            if (showAllOnFocus && !isOpen) { setDesktopBrowsing(true); onSongFilterChange('all'); }
            setIsFocused(true);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full bg-transparent [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden ${inputClassName}`}
          style={isOpen && !isTouchPicker && showSongCategoryFilters ? { paddingRight: 170 } : undefined}
        />
      </div>

      {/* Suggestion Dropdown List (Scrollable on touch/mouse, high z-index) */}
      {isOpen && (isTouchPicker || displayedItems.length > 0 || showSongCategoryFilters) && (() => {
        if (!mobilePickerPosition || mobilePickerPosition.maxHeight <= 0) return null;
        const pickerHost = inputRef.current?.closest<HTMLElement>('.ui-form-screen');
        const hostBounds = pickerHost?.getBoundingClientRect();
        const dropdown = (
          <div
          ref={dropdownRef}
          onPointerMoveCapture={event => {
            const gesture = rowGestureRef.current;
            if (gesture?.id === event.pointerId && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8) gesture.moved = true;
          }}
          onPointerCancelCapture={() => {
            if (rowGestureRef.current) handledRowRef.current = { title: rowGestureRef.current.title, at: Date.now() };
            rowGestureRef.current = null;
          }}
          onScroll={() => {
            lastScrollTimeRef.current = Date.now();
            isScrollingRef.current = true;
            if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
            scrollTimeoutRef.current = setTimeout(() => {
              isScrollingRef.current = false;
            }, 250);
          }}
          onTouchStart={(e) => {
            const touch = e.touches[0];
            touchStartPosRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
            hasMovedRef.current = false;
          }}
          onTouchMove={(e) => {
            if (!touchStartPosRef.current) return;
            const touch = e.touches[0];
            const diffX = Math.abs(touch.clientX - touchStartPosRef.current.x);
            const diffY = Math.abs(touch.clientY - touchStartPosRef.current.y);
            if (diffX > 6 || diffY > 6) {
              hasMovedRef.current = true;
              isScrollingRef.current = true;
              lastScrollTimeRef.current = Date.now();
            }
          }}
          onTouchEnd={() => {
            touchStartPosRef.current = null;
            if (hasMovedRef.current) {
              lastScrollTimeRef.current = Date.now();
            }
            if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
            scrollTimeoutRef.current = setTimeout(() => {
              isScrollingRef.current = false;
              hasMovedRef.current = false;
            }, 250);
          }}
          role={isTouchPicker ? 'dialog' : undefined}
          aria-modal={isTouchPicker || undefined}
          aria-label={isTouchPicker ? (showSongCategoryFilters ? 'Songs' : 'Names and options') : undefined}
          onKeyDown={event => {
            if (event.key === 'Escape') { event.stopPropagation(); closePicker(); }
            if (isTouchPicker && event.key === 'Tab') {
              const controls = dropdownRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, [role="option"]');
              if (!controls?.length) return;
              const first = controls[0], last = controls[controls.length - 1];
              if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
              else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            }
          }}
          data-picker-closing={isPickerClosing || undefined}
          onTransitionEnd={event => { if (event.target === event.currentTarget && event.propertyName === 'transform' && isPickerClosing) finishClosePicker(); }}
          data-picker-fullscreen={isTouchPicker ? isPickerFullscreen : undefined}
          className={`${isTouchPicker ? `relative w-full mx-auto rounded-t-2xl ${isPickerFullscreen ? '' : 'max-w-xl'} motion-reduce:transition-none` : 'fixed z-[200] rounded-2xl'} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col overscroll-contain isolate`}
          style={isTouchPicker ? {
            height: isPickerFullscreen ? mobilePickerPosition.maxHeight : Math.min(mobilePickerPosition.maxHeight, Math.min(560, mobilePickerPosition.maxHeight - 16) + Math.max(0, -pickerDragY)),
            transform: isPickerClosing ? 'translateY(100%)' : `translateY(${Math.max(0, pickerDragY)}px)`,
            pointerEvents: isPickerClosing ? 'none' : undefined,
            transition: isPickerDragging ? 'none' : `height 220ms cubic-bezier(0.22, 1, 0.36, 1), transform ${isPickerClosing ? pickerCloseMs : 220}ms cubic-bezier(0.22, 1, 0.36, 1)`,
            // Keep the drag header below Android's status-bar pull-down area, even when expanded.
            maxHeight: '100%', paddingBottom: 'var(--app-safe-bottom)',
          } : mobilePickerPosition
            ? {
                WebkitOverflowScrolling: 'touch',
                position: pickerHost ? 'absolute' : 'fixed',
                top: mobilePickerPosition.top - (hostBounds?.top ?? 0) + (pickerHost?.scrollTop ?? 0),
                left: mobilePickerPosition.left - (hostBounds?.left ?? 0) + (pickerHost?.scrollLeft ?? 0),
                width: mobilePickerPosition.width,
                maxHeight: mobilePickerPosition.maxHeight,
                clipPath: 'inset(0 -12px)',
                transform: isPickerClosing ? 'translateY(24px)' : 'translateY(0)',
                opacity: isPickerClosing ? 0 : 1,
                pointerEvents: isPickerClosing ? 'none' : undefined,
                transition: `transform ${pickerCloseMs}ms ease-out, opacity ${pickerCloseMs}ms ease-out`,
              }
            : { WebkitOverflowScrolling: 'touch' }}
        >
          {isTouchPicker && <div className="shrink-0 p-3 space-y-3">
            <div data-picker-drag-header className="touch-none select-none"
              onPointerDown={event => {
                if (event.button !== 0 || isPickerClosing) return;
                pickerDragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, lastY: event.clientY, lastTime: event.timeStamp, velocity: 0 };
                ignoreHandleClickRef.current = false;
              }}
              onPointerMove={event => {
                const drag = pickerDragRef.current;
                if (!drag || drag.pointerId !== event.pointerId) return;
                const dy = event.clientY - drag.y;
                if (Math.abs(event.clientX - drag.x) > Math.abs(dy)) return;
                if (Math.abs(dy) > 8) {
                  ignoreHandleClickRef.current = true;
                  setIsPickerDragging(true);
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                }
                drag.velocity = (event.clientY - drag.lastY) / Math.max(1, event.timeStamp - drag.lastTime);
                drag.lastY = event.clientY;
                drag.lastTime = event.timeStamp;
                setPickerDragY(dy);
              }}
              onPointerUp={event => {
                const drag = pickerDragRef.current;
                if (!drag || drag.pointerId !== event.pointerId) return;
                const dy = event.clientY - drag.y;
                const vertical = Math.abs(dy) > Math.abs(event.clientX - drag.x);
                pickerDragRef.current = null;
                setIsPickerDragging(false);
                if (vertical && Math.abs(dy) > 8) ignoreHandleClickRef.current = true;
                if (vertical && dy <= -60) { setIsPickerFullscreen(true); setPickerDragY(0); }
                else if (vertical && dy > 0) releasePickerPull(dy, event.timeStamp - drag.lastTime > 100 ? 0 : drag.velocity);
                else setPickerDragY(0);
              }}
              onPointerCancel={() => { pickerDragRef.current = null; setIsPickerDragging(false); setPickerDragY(0); }}>
            <button type="button" aria-label={isPickerFullscreen ? 'Reduce picker' : 'Expand picker to full screen'} aria-expanded={isPickerFullscreen}
              onClick={() => { if (ignoreHandleClickRef.current) { ignoreHandleClickRef.current = false; return; } setIsPickerFullscreen(current => !current); }}
              className="flex h-11 w-full items-center justify-center cursor-grab active:cursor-grabbing"><span className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" /></button>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">{showSongCategoryFilters ? 'Songs' : 'Names and options'}</h2>
              <button type="button" aria-label="Close picker" onPointerDown={event => event.stopPropagation()} onClick={closePicker} className="h-11 w-11 flex items-center justify-center rounded-full text-slate-500 dark:text-slate-400"><X className="h-5 w-5" /></button>
            </div>
            </div>
            <div className="relative">
              {showSongCategoryFilters && <div className="absolute right-0 top-0 z-20 text-slate-500">{sortControl}</div>}
              <input ref={pickerSearchRef} type="search" aria-label={showSongCategoryFilters ? 'Search songs' : 'Search names or enter a name'} placeholder={showSongCategoryFilters ? 'Search songs' : 'Search or enter a name'} value={pickerQuery} readOnly={isBrowseOnly}
                onClick={event => { event.currentTarget.readOnly = false; setIsBrowseOnly(false); event.currentTarget.focus({ preventScroll: true }); }}
                onChange={event => { setPickerQuery(event.target.value); setHighlightedIndex(-1); }}
                onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (pickerQuery.trim()) handleSelect({ title: displayedItems.find(item => item.title.toLowerCase() === activeQuery)?.title || pickerQuery.trim() }); } }}
                className={`h-11 w-full rounded-xl bg-slate-100 dark:bg-slate-800 text-sm text-slate-900 dark:text-white pl-3 ${showSongCategoryFilters ? 'pr-[170px]' : 'pr-3'}`} />
            </div>
          </div>}
          {isTouchPicker && showSongCategoryFilters && (
            <div className="relative shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-2">

              <div className="flex gap-1.5 overflow-x-auto overscroll-x-contain scrollbar-none pb-0.5 touch-pan-x">
                {SONG_PICKER_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => {
                      onSongFilterChange?.(filter.value);
                      setHighlightedIndex(-1);
                    }}
                    className={`shrink-0 h-7 px-2.5 rounded-full inline-flex items-center gap-1 text-[11px] font-semibold ${
                      songFilter === filter.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {filter.value === 'starred' && (
                      <Star className={`w-3 h-3 ${songFilter === 'starred' ? 'fill-white' : 'fill-yellow-400 text-yellow-500'}`} />
                    )}
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showSongCategoryFilters && !isTouchPicker && (
            <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 px-2 py-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex gap-1.5 overflow-x-auto overscroll-x-contain scrollbar-none pb-0.5 touch-pan-x">
                {SONG_PICKER_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onSongFilterChange?.(filter.value);
                      setHighlightedIndex(-1);
                    }}
                    className={`shrink-0 h-7 px-2.5 rounded-full inline-flex items-center gap-1 text-[11px] font-semibold transition-colors ${
                      songFilter === filter.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {filter.value === 'starred' && (
                      <Star className={`w-3 h-3 ${songFilter === 'starred' ? 'fill-white' : 'fill-yellow-400 text-yellow-500'}`} />
                    )}
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={pickerListRef} role="listbox" aria-label="Suggestions" aria-busy={rawQuery !== activeQuery} className="min-h-0 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 overscroll-contain touch-pan-y">
          {isTouchPicker && pickerQuery.trim() && !matchedItems.some(item => item.title.toLowerCase() === activeQuery) && <button type="button" onClick={event => handleSelect({ title: pickerQuery.trim() }, event)} className="w-full min-h-11 px-4 py-3 text-left text-sm text-blue-600 dark:text-blue-400">Use “{pickerQuery.trim()}”</button>}
          {displayedItems.length === 0 && (
            <div className="px-4 py-5 text-center text-xs text-slate-500 dark:text-slate-400">
              {showSongCategoryFilters ? 'No songs found in this category.' : 'No matching options found.'}
            </div>
          )}

          {displayedItems.map((item, idx) => {
            const isSelected =
              idx === highlightedIndex ||
              item.title.toLowerCase() === lowerVal;

            return (
              <div
                key={item.title + idx}
                role="option"
                aria-selected={isSelected}
                tabIndex={0}
                onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') handleSelect(item, event); }}
                onPointerDown={event => {
                  if (event.button !== 0) return;
                  // Preserve the search keyboard until the chosen title is committed.
                  event.preventDefault();
                  handledRowRef.current = null;
                  rowGestureRef.current = { id: event.pointerId, title: item.title, x: event.clientX, y: event.clientY, moved: false, scrollTop: pickerListRef.current?.scrollTop || 0 };
                }}
                onPointerUp={event => {
                  const gesture = rowGestureRef.current;
                  rowGestureRef.current = null;
                  if (!gesture || gesture.id !== event.pointerId) return;
                  handledRowRef.current = { title: gesture.title, at: Date.now() };
                  if (gesture.title !== item.title || gesture.moved || Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8 || Math.abs((pickerListRef.current?.scrollTop || 0) - gesture.scrollTop) > 4) return;
                  handleSelect(item, event);
                }}
                onMouseDown={(e) => {
                  // Keep input focus
                  e.preventDefault();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleItemClick(item, e);
                }}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`w-full min-h-11 px-4 py-2.5 text-left cursor-pointer transition-colors select-none ${
                  isSelected
                    ? 'bg-slate-100 dark:bg-slate-800/90 text-slate-900 dark:text-white'
                    : 'text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 flex items-center gap-2 text-[14px] font-medium text-slate-900 dark:text-white">
                    <span className="min-w-0 truncate">{item.title}</span>
                    {selectedTitles.has(item.title.trim().toLowerCase()) && <span role="img" aria-label="Selected in this setlist" title="Selected in this setlist" className="shrink-0 text-emerald-600 dark:text-emerald-400"><Check className="h-4 w-4" aria-hidden="true" /></span>}
                  </div>
                  {item.songObj && Boolean(item.songObj.isStarred || (item.songObj as Song & { starred?: boolean }).starred) && (
                    <Star className="w-3.5 h-3.5 shrink-0 fill-yellow-400 text-yellow-500" aria-label="Starred" />
                  )}
                </div>
                {item.matchedField === 'lyrics' && item.lyricSnippet && (
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 italic truncate mt-0.5">
                    🎵 "{item.lyricSnippet}"
                  </div>
                )}
              </div>
            );
          })}
          {!activeQuery && matchedItems.length > displayedItems.length && <button type="button" onClick={() => setBrowseLimit(limit => limit + 80)} className="w-full min-h-11 px-4 py-3 text-sm text-blue-600 dark:text-blue-400">Show more songs ({matchedItems.length - displayedItems.length} remaining)</button>}
          </div>
          </div>
        );


        // Keep the picker in the dialog's stacking context, below its action bar.
        // Keep even the expanded drag handle below the system notification gesture area.
        // Subtract only the inset still visible above the visual viewport (e.g. with a keyboard).
        if (isTouchPicker) return createPortal(<div className="fixed z-[200] inset-x-0 flex flex-col justify-end" style={{
          top: `max(${mobilePickerPosition.top}px, calc(var(--app-safe-top, 0px) + 12px))`,
          height: `calc(${mobilePickerPosition.maxHeight}px - max(0px, calc(var(--app-safe-top, 0px) + 12px - ${mobilePickerPosition.top}px)))`,
        }}>
          <button type="button" aria-label="Dismiss picker" onClick={closePicker} className="absolute inset-0 bg-black/50" />
          {dropdown}
        </div>, document.body);
        return createPortal(dropdown, pickerHost || document.body);
      })()}
    </div>
  );
};

export const AutofillInput = React.memo(AutofillInputComponent);
