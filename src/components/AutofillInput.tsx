import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Song, Setlist } from '../types';
import {
  fuzzyMatchString,
  searchSong,
  getSongUsageHistory,
  getSongUsageHistoryFromMap,
  buildSongUsageMap,
  SongUsageHistory,
} from '../utils/songSearch';
import { Clock, AlertTriangle, Check, CornerDownLeft } from 'lucide-react';

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
  suggestions?: string[]; // Primary suggestions (e.g. marked welcome/closing songs or song titles)
  allSuggestions?: string[]; // Fallback full library suggestions when user types
  defaultValue?: string; // Default song (e.g. 'Napakaligaya' or 'Give Thanks')
  songs?: Song[]; // Full song library for lyrics search and metadata
  setlists?: Setlist[]; // Setlists for last-sung history & repetition warnings
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  required?: boolean;
  type?: string;
  onSelectSuggestion?: (val: string) => void;
  id?: string;
  showAllOnFocus?: boolean;
}

const AutofillInputComponent: React.FC<AutofillInputProps> = ({
  value,
  onChange,
  suggestions = [],
  allSuggestions,
  defaultValue,
  songs,
  setlists,
  placeholder,
  className = '',
  inputClassName = '',
  required = false,
  type = 'text',
  onSelectSuggestion,
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cleanVal = (value || '').trim();
  const lowerVal = cleanVal.toLowerCase();
  const cleanDefault = (defaultValue || '').trim().toLowerCase();

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
  const displayedItems: DisplaySuggestionItem[] = useMemo(() => {
    if (!isOpen) return [];

    // Lookup map for Song objects by lowercase title
    const songMap = new Map<string, Song>();
    if (songs) {
      for (const s of songs) {
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
    if (!lowerVal || (cleanDefault && lowerVal === cleanDefault)) {
      if (suggestions && suggestions.length > 0) {
        return suggestions.map((s) => buildItem(s, 'none', undefined, 100));
      }
      if (songs && songs.length > 0) {
        return songs.slice(0, 20).map((s) => buildItem(s.title, 'none', undefined, 100));
      }
      return [];
    }

    // 2. If songs array is available, search across all songs in the library
    if (songs && songs.length > 0) {
      const scoredResults: DisplaySuggestionItem[] = [];
      const primarySet = new Set(suggestions.map((t) => t.toLowerCase().trim()));

      for (const s of songs) {
        const searchRes = searchSong(s, lowerVal);
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
      const pool = allSuggestions && allSuggestions.length > 0 ? allSuggestions : suggestions;
      for (const raw of pool) {
        if (raw && !knownTitles.has(raw.toLowerCase().trim())) {
          const match = fuzzyMatchString(raw, lowerVal);
          if (match.matches) {
            scoredResults.push(buildItem(raw, 'title', undefined, match.score));
          }
        }
      }

      // Sort by score descending
      scoredResults.sort((a, b) => (b.score || 0) - (a.score || 0));
      return scoredResults.slice(0, 25);
    }

    // 3. Fallback string-based fuzzy search for names or custom string lists
    const pool = allSuggestions && allSuggestions.length > 0 ? allSuggestions : suggestions;
    const results: DisplaySuggestionItem[] = [];

    for (const title of pool) {
      if (!title) continue;
      const match = fuzzyMatchString(title, lowerVal);
      if (match.matches) {
        const isPrimary = suggestions.includes(title);
        results.push(buildItem(title, 'title', undefined, match.score + (isPrimary ? 10 : 0)));
      }
    }

    results.sort((a, b) => (b.score || 0) - (a.score || 0));
    return results.slice(0, 25);
  }, [isOpen, lowerVal, cleanDefault, suggestions, allSuggestions, songs, usageMap]);

  // Find exact prefix match for inline autocomplete ghost text only when focused & typing
  const bestPrefixMatch = useMemo(() => {
    if (!isFocused || !lowerVal || lowerVal.length < 2) return undefined;

    // Search fast in suggestions first
    if (suggestions && suggestions.length > 0) {
      const match = suggestions.find(
        (s) => s && s.toLowerCase().startsWith(lowerVal) && s.length > cleanVal.length
      );
      if (match) return match;
    }

    // Search in songs next
    if (songs && songs.length > 0) {
      const songMatch = songs.find(
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
  }, [isFocused, lowerVal, cleanVal.length, suggestions, songs, allSuggestions]);

  const ghostSuffix = bestPrefixMatch
    ? bestPrefixMatch.slice((value || '').length)
    : '';

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

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
    setHighlightedIndex(-1);
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
        >
          <span className="opacity-0 whitespace-pre">{value}</span>
          <span className="text-slate-400/80 dark:text-slate-500 font-medium whitespace-pre">
            {ghostSuffix}
          </span>
          <button
            type="button"
            onMouseDown={handleAcceptPrefix}
            onTouchStart={handleAcceptPrefix}
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
        <input
          ref={inputRef}
          id={id}
          type={type}
          required={required}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => {
            setIsFocused(true);
            setIsOpen(true);
          }}
          onBlur={() => {
            setIsFocused(false);
          }}
          onClick={() => {
            setIsFocused(true);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full bg-transparent ${inputClassName}`}
        />
      </div>

      {/* Subtle Inline Repetition Warning (if entered song was sung recently in the last 14 days) */}
      {currentValueHistory?.isRecent && !isOpen && (
        <div className="flex items-center gap-1.5 mt-1 px-1 text-[11px] text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span>
            Sung recently on {currentValueHistory.formattedLastDate} ({currentValueHistory.relativeTimeAgo})
          </span>
        </div>
      )}

      {/* Suggestion Dropdown List (High z-index to stay visible over dialogs and forms) */}
      {isOpen && displayedItems.length > 0 && (
        <div className="absolute z-[100] left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-h-72 overflow-y-auto py-1 divide-y divide-slate-100 dark:divide-slate-800/80">
          {displayedItems.map((item, idx) => {
            const isSelected =
              idx === highlightedIndex ||
              item.title.toLowerCase() === lowerVal;

            return (
              <div
                key={item.title + idx}
                onMouseDown={(e) => handleSelect(item, e)}
                onTouchStart={(e) => handleSelect(item, e)}
                onClick={(e) => handleSelect(item, e)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`w-full px-4 py-3 text-left flex items-center justify-between cursor-pointer transition-colors select-none ${
                  isSelected
                    ? 'bg-slate-100 dark:bg-slate-800/90 text-slate-900 dark:text-white'
                    : 'text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="min-w-0 pr-3 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-bold text-slate-900 dark:text-white truncate">
                      {item.title}
                    </span>

                    {/* Welcome / Closing / Special Badges */}
                    {item.songObj?.isWelcomeSong && (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-100 dark:bg-sky-950/90 text-sky-700 dark:text-sky-400 border border-sky-300 dark:border-sky-800/80 shrink-0">
                        Welcome
                      </span>
                    )}
                    {item.songObj?.isClosingSong && (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-100 dark:bg-indigo-950/90 text-indigo-700 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-800/80 shrink-0">
                        Closing
                      </span>
                    )}
                    {item.songObj?.isSpecialNumber && (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-100 dark:bg-purple-950/90 text-purple-700 dark:text-purple-400 border border-purple-300 dark:border-purple-800/80 shrink-0">
                        Special
                      </span>
                    )}
                    {item.songObj?.category &&
                      item.songObj.category !== 'Praise & Worship' &&
                      !item.songObj?.isWelcomeSong &&
                      !item.songObj?.isClosingSong &&
                      !item.songObj?.isSpecialNumber && (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 shrink-0">
                          {item.songObj.category}
                        </span>
                      )}

                    {/* Repetition Warning Pill (if recent) */}
                    {item.history?.isRecent && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60 shrink-0">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        <span>Sung {item.history.relativeTimeAgo}</span>
                      </span>
                    )}
                  </div>

                  {/* Subtitle: Clock Icon + Last Scheduled / Not yet scheduled / Lyric snippet */}
                  <div className="flex items-center gap-2 text-xs mt-1 flex-wrap">
                    {item.matchedField === 'lyrics' && item.lyricSnippet ? (
                      <span className="text-emerald-600 dark:text-emerald-400 italic text-xs truncate max-w-xs">
                        🎵 "{item.lyricSnippet}"
                      </span>
                    ) : item.history && item.history.relativeTimeAgo ? (
                      <span className="text-slate-500 dark:text-slate-400 text-xs flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Last: {item.history.relativeTimeAgo}</span>
                      </span>
                    ) : item.history && !item.history.relativeTimeAgo ? (
                      <span className="text-slate-400 dark:text-slate-500 text-xs">
                        Not yet scheduled
                      </span>
                    ) : item.songObj?.artist ? (
                      <span className="text-slate-400 dark:text-slate-500 text-xs">
                        {item.songObj.artist}
                      </span>
                    ) : null}
                  </div>
                </div>

                <button
                  type="button"
                  onMouseDown={(e) => handleSelect(item, e)}
                  onTouchStart={(e) => handleSelect(item, e)}
                  onClick={(e) => handleSelect(item, e)}
                  className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 shrink-0 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Select</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const AutofillInput = React.memo(AutofillInputComponent);
