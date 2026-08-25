import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Song, Setlist } from '../types';
import { fuzzyMatchString, searchSong, getSongUsageHistory, SongUsageHistory } from '../utils/songSearch';
import { Clock, AlertTriangle } from 'lucide-react';

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
  suggestions: string[]; // Primary suggestions (e.g. marked welcome/closing songs)
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

export const AutofillInput: React.FC<AutofillInputProps> = ({
  value,
  onChange,
  suggestions,
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
  showAllOnFocus = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const cleanVal = (value || '').trim();
  const lowerVal = cleanVal.toLowerCase();
  const cleanDefault = (defaultValue || '').trim().toLowerCase();

  // Pre-calculate usage history for current value (if setlists provided)
  const currentValueHistory = useMemo(() => {
    if (!setlists || !cleanVal) return null;
    return getSongUsageHistory(cleanVal, setlists);
  }, [cleanVal, setlists]);

  // Compute displayed suggestions with fuzzy match, lyrics search, and usage history
  const displayedItems: DisplaySuggestionItem[] = useMemo(() => {
    // Lookup map for Song objects by lowercase title
    const songMap = new Map<string, Song>();
    if (songs) {
      for (const s of songs) {
        songMap.set(s.title.toLowerCase().trim(), s);
      }
    }

    const buildItem = (
      title: string,
      matchedField: 'title' | 'artist' | 'lyrics' | 'none' = 'title',
      lyricSnippet?: string,
      score: number = 50
    ): DisplaySuggestionItem => {
      const songObj = songMap.get(title.toLowerCase().trim());
      const history = setlists ? getSongUsageHistory(title, setlists) : undefined;
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
      return suggestions.map((s) => buildItem(s, 'none', undefined, 100));
    }

    // 2. If songs array is available, perform full fuzzy search across titles, artists, and lyrics
    if (songs && songs.length > 0) {
      const isDualMode = allSuggestions && allSuggestions.length > 0;
      const targetSongList = isDualMode ? songs : songs.filter((s) => suggestions.includes(s.title));

      const scoredResults: DisplaySuggestionItem[] = [];

      for (const s of targetSongList) {
        const searchRes = searchSong(s, lowerVal);
        if (searchRes.matches) {
          const isPrimary = suggestions.includes(s.title);
          const boostedScore = searchRes.score + (isPrimary ? 15 : 0);
          const history = setlists ? getSongUsageHistory(s.title, setlists) : undefined;

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
      const knownTitles = new Set(scoredResults.map((r) => r.title.toLowerCase()));
      const pool = allSuggestions && allSuggestions.length > 0 ? allSuggestions : suggestions;
      for (const raw of pool) {
        if (!knownTitles.has(raw.toLowerCase())) {
          const match = fuzzyMatchString(raw, lowerVal);
          if (match.matches) {
            scoredResults.push(buildItem(raw, 'title', undefined, match.score));
          }
        }
      }

      // Sort by score descending
      scoredResults.sort((a, b) => (b.score || 0) - (a.score || 0));
      return scoredResults;
    }

    // 3. Fallback string-based fuzzy search
    const pool = allSuggestions && allSuggestions.length > 0 ? allSuggestions : suggestions;
    const results: DisplaySuggestionItem[] = [];

    for (const title of pool) {
      const match = fuzzyMatchString(title, lowerVal);
      if (match.matches) {
        const isPrimary = suggestions.includes(title);
        results.push(buildItem(title, 'title', undefined, match.score + (isPrimary ? 10 : 0)));
      }
    }

    results.sort((a, b) => (b.score || 0) - (a.score || 0));
    return results;
  }, [lowerVal, cleanDefault, suggestions, allSuggestions, songs, setlists]);

  // Active pool for ghost text prefix match
  const searchPool = useMemo(() => {
    if (allSuggestions && allSuggestions.length > 0) return allSuggestions;
    if (songs && songs.length > 0) return songs.map((s) => s.title);
    return suggestions;
  }, [allSuggestions, songs, suggestions]);

  const bestPrefixMatch = searchPool.find(
    (s) =>
      lowerVal &&
      s.toLowerCase().startsWith(lowerVal) &&
      s.length > (value || '').length
  );

  const ghostSuffix = bestPrefixMatch
    ? bestPrefixMatch.slice((value || '').length)
    : '';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        const selected = displayedItems[highlightedIndex].title;
        onChange(selected);
        onSelectSuggestion?.(selected);
        setIsOpen(false);
        setHighlightedIndex(-1);
      } else if (bestPrefixMatch) {
        e.preventDefault();
        onChange(bestPrefixMatch);
        onSelectSuggestion?.(bestPrefixMatch);
        setIsOpen(false);
      } else if (displayedItems.length > 0 && isOpen) {
        e.preventDefault();
        const selected = displayedItems[0].title;
        onChange(selected);
        onSelectSuggestion?.(selected);
        setIsOpen(false);
      }
    } else if (e.key === 'Tab' && bestPrefixMatch) {
      e.preventDefault();
      onChange(bestPrefixMatch);
      onSelectSuggestion?.(bestPrefixMatch);
      setIsOpen(false);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelect = (item: DisplaySuggestionItem) => {
    onChange(item.title);
    onSelectSuggestion?.(item.title);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Ghost text display overlay behind input */}
      {bestPrefixMatch && (
        <div className="absolute inset-0 pointer-events-none flex items-center px-3 py-2 text-sm select-none overflow-hidden pr-8">
          <span className="opacity-0 whitespace-pre">{value}</span>
          <span className="text-slate-400/80 dark:text-slate-500 font-medium whitespace-pre">
            {ghostSuffix}
          </span>
          <span className="ml-auto text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
            ↵ Enter
          </span>
        </div>
      )}

      <div className="relative flex items-center w-full">
        <input
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
            setIsOpen(true);
          }}
          onClick={() => {
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

      {/* Suggestion Dropdown List */}
      {isOpen && displayedItems.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-h-72 overflow-y-auto py-1 divide-y divide-slate-100 dark:divide-slate-800/80">
          {displayedItems.map((item, idx) => {
            const isSelected =
              idx === highlightedIndex ||
              item.title.toLowerCase() === lowerVal;

            return (
              <button
                key={item.title + idx}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(item);
                }}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`w-full px-4 py-3 text-left flex items-center justify-between cursor-pointer transition-colors ${
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

                <span className="text-xs font-semibold text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white px-2 py-1 shrink-0 transition-colors">
                  Select
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
