import { pickerPlacement } from '../utils/pickerPlacement';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Song, Setlist } from '../types';
import {
  fuzzyMatchString,
  searchSong,
  getSongUsageHistoryFromMap,
  buildSongUsageMap,
  SongUsageHistory,
} from '../utils/songSearch';
import { AlertTriangle, CornerDownLeft, Star, X, ArrowDownAZ, ArrowUpAZ, ListFilter } from 'lucide-react';

export type SongPickerFilter = 'all' | 'starred' | 'Hymn' | 'Special' | 'Contemporary' | 'Choir' | 'Tagalog';

const SONG_PICKER_FILTERS: Array<{ value: SongPickerFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'starred', label: 'Starred' },
  { value: 'Hymn', label: 'Hymn' },
  { value: 'Special', label: 'Special' },
  { value: 'Contemporary', label: 'Contemporary' },
  { value: 'Choir', label: 'Choir' },
  { value: 'Tagalog', label: 'Tagalog' },
];

function songMatchesPickerFilter(song: Song, filter: SongPickerFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'starred') return Boolean(song.isStarred || (song as Song & { starred?: boolean }).starred);
  const categories = Array.isArray(song.categories)
    ? song.categories
    : (song.category || '').split(',').map((category) => category.trim());
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
  showSongCategoryFilters: categoryFiltersRequested = false,
  songFilter: controlledSongFilter,
  onSongFilterChange: onControlledFilterChange,
}) => {
  const showSongCategoryFilters = categoryFiltersRequested || songs !== undefined;
  const [localSongFilter, setLocalSongFilter] = useState<SongPickerFilter>('all');
  const songFilter = controlledSongFilter ?? localSongFilter;
  const onSongFilterChange = (filter: SongPickerFilter) => {
    setLocalSongFilter(filter);
    onControlledFilterChange?.(filter);
  };
  const [songSort, setSongSort] = useState<'relevance' | 'az' | 'za'>('relevance');
  const SortIcon = songSort === 'az' ? ArrowDownAZ : songSort === 'za' ? ArrowUpAZ : ListFilter;
  const sortLabel = songSort === 'az' ? 'A–Z' : songSort === 'za' ? 'Z–A' : 'Relevance';
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isTouchPicker, setIsTouchPicker] = useState(false);
  const [isBrowseOnly, setIsBrowseOnly] = useState(true);
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
  const scrollTimeoutRef = useRef<any>(null);

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
    let usableTop = Math.max(viewportTop + 12, bodyRect?.top ?? formRect?.top ?? viewportTop + 12);
    let usableBottom = Math.min(viewportBottom - 12, bodyRect?.bottom ?? formRect?.bottom ?? viewportBottom - 12);
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
  const activeQuery = isTouchPicker && isBrowseOnly ? '' : lowerVal;
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
    const ordered = !showSongCategoryFilters || songSort === 'relevance' ? matchedItems : [...matchedItems].sort((a, b) => (songSort === 'az' ? 1 : -1) * a.title.localeCompare(b.title));
    return activeQuery ? ordered.slice(0, 30) : ordered;
  }, [matchedItems, songSort, showSongCategoryFilters, activeQuery]);

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
        setIsOpen(false);
        setIsFocused(false);
        setIsBrowseOnly(true);
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
        setIsOpen(false);
        setIsFocused(false);
        setIsBrowseOnly(true);
      }
    };

    document.addEventListener('mousedown', handleMouseDownOutside);
    document.addEventListener('touchstart', handleTouchStartOutside, { passive: true });
    document.addEventListener('touchmove', handleTouchMoveOutside, { passive: true });
    document.addEventListener('touchend', handleTouchEndOutside, { passive: true });

    return () => {
      document.removeEventListener('mousedown', handleMouseDownOutside);
      document.removeEventListener('touchstart', handleTouchStartOutside);
      document.removeEventListener('touchmove', handleTouchMoveOutside);
      document.removeEventListener('touchend', handleTouchEndOutside);
    };
  }, []);

  // Track any scrolling anywhere on page/modal while dropdown is open to prevent accidental selection
  useEffect(() => {
    if (!isOpen) return;

    const onAnyScroll = () => {
      lastScrollTimeRef.current = Date.now();
      isScrollingRef.current = true;
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = setTimeout(() => {
        isScrollingRef.current = false;
      }, 250);
    };

    window.addEventListener('scroll', onAnyScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener('scroll', onAnyScroll, { capture: true });
    };
  }, [isOpen]);

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

  const handleSelect = (item: DisplaySuggestionItem, e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    onChange(item.title);
    onSelectSuggestion?.(item.title);
    setIsOpen(false);
    setIsBrowseOnly(true);
    setHighlightedIndex(-1);
  };

  // Safe click handler: only select if not scrolling, dragging, or within scroll cooldown buffer
  const handleItemClick = (item: DisplaySuggestionItem, e?: React.MouseEvent) => {
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
      {bestPrefixMatch && isFocused && (
        <div
          onClick={handleAcceptPrefix}
          className="absolute inset-0 flex items-center px-3 py-2 text-sm select-none overflow-hidden pr-2 cursor-pointer pointer-events-none"
          style={isOpen && showSongCategoryFilters ? { paddingLeft: 44 } : undefined}
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
        {isOpen && showSongCategoryFilters && <button type="button" aria-label={`Sort songs: ${sortLabel}. Tap to change`} title={`Sort: ${sortLabel}`} className="absolute left-0 z-10 flex h-11 w-11 items-center justify-center text-slate-500 dark:text-slate-400" onPointerDown={event => event.preventDefault()} onClick={() => { setSongSort(current => current === 'relevance' ? 'az' : current === 'az' ? 'za' : 'relevance'); setHighlightedIndex(-1); }}><SortIcon className="h-5 w-5" aria-hidden="true" /></button>}
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
          readOnly={isTouchPicker && isBrowseOnly}
          value={value}
          onPointerDown={(event) => {
            if (event.pointerType !== 'touch') return;
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
              setMobilePickerPosition(null);
              setIsOpen(true);
              setHighlightedIndex(-1);
              requestAnimationFrame(() => positionMobilePicker(true));
              return;
            }

            if (isBrowseOnly) {
              // A second completed stationary tap explicitly opts into typing.
              const input = inputRef.current;
              if (!input) return;
              input.readOnly = false;
              setIsBrowseOnly(false);
              requestAnimationFrame(() => {
                input.focus();
                input.select();
              });
            }
          }}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => {
            setIsFocused(true);
            setIsOpen(true);
          }}
          onClick={() => {
            if (ignoreTouchClickRef.current) {
              ignoreTouchClickRef.current = false;
              return;
            }
            setIsFocused(true);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full bg-transparent [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden ${inputClassName}`}
          style={isOpen && showSongCategoryFilters ? { paddingLeft: 44 } : undefined}
        />
      </div>

      {/* Suggestion Dropdown List (Scrollable on touch/mouse, high z-index) */}
      {isOpen && (displayedItems.length > 0 || showSongCategoryFilters) && (() => {
        if (!mobilePickerPosition || mobilePickerPosition.maxHeight <= 0) return null;
        const pickerHost = inputRef.current?.closest<HTMLElement>('.ui-form-screen');
        const hostBounds = pickerHost?.getBoundingClientRect();
        const dropdown = (
          <div
          ref={dropdownRef}
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
          className={`fixed z-[200] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col overscroll-contain isolate`}
          style={mobilePickerPosition
            ? {
                WebkitOverflowScrolling: 'touch',
                position: pickerHost ? 'absolute' : 'fixed',
                top: mobilePickerPosition.top - (hostBounds?.top ?? 0) + (pickerHost?.scrollTop ?? 0),
                left: mobilePickerPosition.left - (hostBounds?.left ?? 0) + (pickerHost?.scrollLeft ?? 0),
                width: mobilePickerPosition.width,
                maxHeight: mobilePickerPosition.maxHeight,
                clipPath: 'inset(0 -12px)',
              }
            : { WebkitOverflowScrolling: 'touch' }}
        >
          {isTouchPicker && showSongCategoryFilters && (
            <div className="relative shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-2 pr-11">
              <button
                type="button"
                aria-label="Close picker"
                onClick={() => {
                  setIsOpen(false);
                  setIsFocused(false);
                  setIsBrowseOnly(true);
                }}
                className="absolute right-2 top-1.5 z-10 p-1.5 rounded-lg text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>

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

          <div className="min-h-0 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 overscroll-contain touch-pan-y">
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
                className={`w-full px-4 py-2.5 text-left cursor-pointer transition-colors select-none ${
                  isSelected
                    ? 'bg-slate-100 dark:bg-slate-800/90 text-slate-900 dark:text-white'
                    : 'text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 text-[14px] font-medium text-slate-900 dark:text-white truncate">
                    {item.title}
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
          </div>
          </div>
        );


        // Keep the picker in the dialog's stacking context, below its action bar.
        return createPortal(dropdown, pickerHost || document.body);
      })()}
    </div>
  );
};

export const AutofillInput = React.memo(AutofillInputComponent);
