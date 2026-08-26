import { Song, Setlist } from '../types';
import { parseDate, getTodayStr, formatDateStr } from './dateUtils';

/**
 * Calculates Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix: number[][] = [];
  for (let i = 0; i <= bn; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= an; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[bn][an];
}

/**
 * Clean & normalize text for fuzzy comparison
 */
export function normalizeForSearch(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-z0-9\s]/g, ' ')   // replace punctuation with spaces
    .replace(/\s+/g, ' ')
    .trim();
}

export interface FuzzyMatchResult {
  matches: boolean;
  score: number; // Higher is better (0 to 100)
  typoDistance?: number;
}

/**
 * Fuzzy search a target string against query with typo tolerance
 */
export function fuzzyMatchString(target: string, query: string): FuzzyMatchResult {
  const normTarget = normalizeForSearch(target);
  const normQuery = normalizeForSearch(query);

  if (!normQuery) return { matches: true, score: 100 };
  if (!normTarget) return { matches: false, score: 0 };

  // 1. Exact equality
  if (normTarget === normQuery) {
    return { matches: true, score: 100 };
  }

  // 2. Target starts with query (Prefix match)
  if (normTarget.startsWith(normQuery)) {
    return { matches: true, score: 95 };
  }

  // 3. Exact Substring match
  if (normTarget.includes(normQuery)) {
    return { matches: true, score: 85 };
  }

  // 4. Word-by-word prefix match (e.g. "gra" matches "Amazing Grace")
  const targetWords = normTarget.split(' ');
  const queryWords = normQuery.split(' ');
  const allQueryWordsMatch = queryWords.every((qw) =>
    targetWords.some((tw) => tw.startsWith(qw) || tw.includes(qw))
  );
  if (allQueryWordsMatch) {
    return { matches: true, score: 80 };
  }

  // 5. Acronym / Initials match (e.g. "gog" matches "Goodness of God", "dk" matches "Dakilang Katapatan")
  const initials = targetWords.map((w) => w[0]).join('');
  if (initials.includes(normQuery)) {
    return { matches: true, score: 75 };
  }

  // 6. Typo Tolerance / Levenshtein Distance for short & medium terms
  // Only apply fuzzy distance if query has at least 3 characters
  if (normQuery.length >= 3) {
    // Check against full target if target length is close
    if (Math.abs(normTarget.length - normQuery.length) <= 3) {
      const dist = levenshteinDistance(normTarget, normQuery);
      const maxAllowed = normQuery.length <= 4 ? 1 : normQuery.length <= 8 ? 2 : 3;
      if (dist <= maxAllowed) {
        return { matches: true, score: 70 - dist * 5, typoDistance: dist };
      }
    }

    // Check individual target words for typos
    for (const tw of targetWords) {
      if (tw.length >= 3) {
        const dist = levenshteinDistance(tw.slice(0, Math.max(tw.length, normQuery.length)), normQuery);
        const maxAllowed = normQuery.length <= 4 ? 1 : 2;
        if (dist <= maxAllowed) {
          return { matches: true, score: 65 - dist * 5, typoDistance: dist };
        }
      }
    }
  }

  return { matches: false, score: 0 };
}

export interface SongSearchResult {
  song: Song;
  matches: boolean;
  score: number;
  matchedField: 'title' | 'artist' | 'lyrics' | 'none';
  lyricSnippet?: string;
}

/**
 * Searches a song across title, artist, and full lyrics with fuzzy tolerance
 */
export function searchSong(song: Song, query: string): SongSearchResult {
  if (!query || !query.trim()) {
    return {
      song,
      matches: true,
      score: 100,
      matchedField: 'none',
    };
  }

  // 1. Check title first (highest weight)
  const titleMatch = fuzzyMatchString(song.title, query);
  if (titleMatch.matches) {
    return {
      song,
      matches: true,
      score: titleMatch.score + 20,
      matchedField: 'title',
    };
  }

  // 2. Check artist
  if (song.artist) {
    const artistMatch = fuzzyMatchString(song.artist, query);
    if (artistMatch.matches) {
      return {
        song,
        matches: true,
        score: artistMatch.score + 10,
        matchedField: 'artist',
      };
    }
  }

  // 3. Check lyrics
  if (song.lyrics) {
    const normLyrics = normalizeForSearch(song.lyrics);
    const normQuery = normalizeForSearch(query);

    if (normLyrics.includes(normQuery)) {
      const snippet = extractLyricSnippet(song.lyrics, query);
      return {
        song,
        matches: true,
        score: 60,
        matchedField: 'lyrics',
        lyricSnippet: snippet,
      };
    }

    // Fuzzy lyrics word matching for queries >= 4 chars
    if (normQuery.length >= 4) {
      const lyricLines = song.lyrics.split(/\r?\n/).filter(Boolean);
      for (const line of lyricLines) {
        const lineMatch = fuzzyMatchString(line, query);
        if (lineMatch.matches) {
          return {
            song,
            matches: true,
            score: 50,
            matchedField: 'lyrics',
            lyricSnippet: line.trim(),
          };
        }
      }
    }
  }

  return {
    song,
    matches: false,
    score: 0,
    matchedField: 'none',
  };
}

/**
 * Extracts a neat snippet of lyrics around the matched query
 */
export function extractLyricSnippet(lyrics: string, query: string): string {
  if (!lyrics || !query) return '';
  const cleanQ = query.trim().toLowerCase();
  const lowerLyrics = lyrics.toLowerCase();
  const idx = lowerLyrics.indexOf(cleanQ);

  if (idx === -1) {
    // Return first non-empty line
    const firstLine = lyrics.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) || '';
    return firstLine.slice(0, 60);
  }

  // Find line or sentence containing match
  const start = Math.max(0, idx - 25);
  const end = Math.min(lyrics.length, idx + query.length + 35);
  let snippet = lyrics.slice(start, end).replace(/[\r\n]+/g, ' ').trim();

  if (start > 0) snippet = '...' + snippet;
  if (end < lyrics.length) snippet = snippet + '...';
  return snippet;
}

export interface SongUsageHistory {
  lastDate: string | null;
  formattedLastDate: string | null;
  relativeTimeAgo: string | null;
  isRecent: boolean; // Kept for type compatibility
  isInCooldown: boolean; // 1-week allowance rule (sung within 7 days or scheduled within 7 days)
  cooldownMessage?: string;
  totalCount: number;
  recentSetlistDate?: string;
  upcomingDate?: string | null;
}

// Global WeakMap / memoized map cache for setlists array reference
let cachedSetlistsRef: Setlist[] | null = null;
let cachedPastUsageMap: Map<string, string[]> = new Map();
let cachedUpcomingUsageMap: Map<string, string[]> = new Map();
let cachedAllUsageMap: Map<string, string[]> = new Map();

/**
 * Pre-builds O(1) lookup Maps:
 * - Past dates Map (from grayed out / completed past setlists only)
 * - Upcoming dates Map (from active / lined-up upcoming setlists)
 */
export function buildSongUsageMap(setlists: Setlist[], todayStr: string = getTodayStr()): Map<string, string[]> {
  if (!setlists || setlists.length === 0) return new Map();

  if (cachedSetlistsRef === setlists) {
    return cachedAllUsageMap;
  }

  const pastMap = new Map<string, string[]>();
  const upcomingMap = new Map<string, string[]>();
  const allMap = new Map<string, string[]>();

  const addEntry = (map: Map<string, string[]>, title: string | undefined, date: string) => {
    if (!title || !date) return;
    const key = normalizeForSearch(title);
    if (!key) return;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, [date]);
    } else if (!existing.includes(date)) {
      existing.push(date);
    }
  };

  for (const setlist of setlists) {
    const date = setlist.date;
    if (!date) continue;

    const isPast = date < todayStr;
    const targetMap = isPast ? pastMap : upcomingMap;

    const recordSong = (title?: string) => {
      if (title) {
        addEntry(targetMap, title, date);
        addEntry(allMap, title, date);
      }
    };

    if (setlist.welcomeSong) recordSong(setlist.welcomeSong);
    if (setlist.closingSong) recordSong(setlist.closingSong);
    if (setlist.themeSong) recordSong(setlist.themeSong);

    if (setlist.sundaySchool?.songs) {
      for (const s of setlist.sundaySchool.songs) {
        if (s.title) recordSong(s.title);
      }
    }

    if (setlist.worshipService?.songs) {
      for (const s of setlist.worshipService.songs) {
        if (s.title) recordSong(s.title);
      }
    }

    if (setlist.program?.songs) {
      for (const s of setlist.program.songs) {
        if (s.title) recordSong(s.title);
      }
    }
  }

  // Sort dates descending for each map
  for (const dates of pastMap.values()) {
    dates.sort((a, b) => b.localeCompare(a));
  }
  for (const dates of upcomingMap.values()) {
    dates.sort((a, b) => a.localeCompare(b)); // soonest first for upcoming
  }
  for (const dates of allMap.values()) {
    dates.sort((a, b) => b.localeCompare(a));
  }

  cachedSetlistsRef = setlists;
  cachedPastUsageMap = pastMap;
  cachedUpcomingUsageMap = upcomingMap;
  cachedAllUsageMap = allMap;

  return allMap;
}

/**
 * Instant O(1) usage history lookup:
 * - Past History: strictly calculated from past completed setlists.
 * - Cooldown Notice: warns only if sung within last 7 days or scheduled in upcoming setlist within 7 days.
 */
export function getSongUsageHistoryFromMap(
  songTitleOrId: string,
  usageMap: Map<string, string[]>,
  todayStr: string = getTodayStr()
): SongUsageHistory {
  if (!songTitleOrId || !songTitleOrId.trim()) {
    return {
      lastDate: null,
      formattedLastDate: null,
      relativeTimeAgo: null,
      isRecent: false,
      isInCooldown: false,
      totalCount: 0,
    };
  }

  const cleanTarget = normalizeForSearch(songTitleOrId);
  const pastDates = cachedPastUsageMap.get(cleanTarget) || [];
  const upcomingDates = cachedUpcomingUsageMap.get(cleanTarget) || [];
  const allDates = usageMap.get(cleanTarget) || [];

  const todayDate = parseDate(todayStr);

  // 1. Last Sung (from past setlists only)
  let lastDate: string | null = null;
  let formattedLastDate: string | null = null;
  let relativeTimeAgo: string | null = null;
  let isInCooldown = false;
  let cooldownMessage: string | undefined = undefined;

  if (pastDates.length > 0) {
    lastDate = pastDates[0];
    const pastDateObj = parseDate(lastDate);
    const diffTime = todayDate.getTime() - pastDateObj.getTime();
    const diffDays = Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));

    if (diffDays === 0) {
      relativeTimeAgo = 'Today';
    } else if (diffDays === 7) {
      relativeTimeAgo = '1 week ago';
    } else if (diffDays < 7) {
      relativeTimeAgo = `${diffDays}d ago`;
    } else if (diffDays < 14) {
      relativeTimeAgo = '1 week ago';
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      relativeTimeAgo = `${weeks} wks ago`;
    } else if (diffDays < 60) {
      relativeTimeAgo = '1 month ago';
    } else {
      const months = Math.floor(diffDays / 30);
      relativeTimeAgo = `${months} mos ago`;
    }

    formattedLastDate = formatDateStr(lastDate, { shortMonth: true });

    // 1-week allowance rule: song was sung within 7 days
    if (diffDays <= 7) {
      isInCooldown = true;
      cooldownMessage = `Sung in last week's setlist (${formattedLastDate}) — 1 week rest recommended`;
    }
  }

  // 2. Check upcoming scheduled setlists for cooldown
  let upcomingDate: string | null = null;
  if (upcomingDates.length > 0) {
    upcomingDate = upcomingDates[0];
    const upcomingDateObj = parseDate(upcomingDate);
    const diffTime = upcomingDateObj.getTime() - todayDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays <= 7) {
      isInCooldown = true;
      const formattedUpcoming = formatDateStr(upcomingDate, { shortMonth: true });
      cooldownMessage = cooldownMessage || `Already scheduled in upcoming setlist on ${formattedUpcoming}`;
    }
  }

  return {
    lastDate,
    formattedLastDate: formattedLastDate || (upcomingDate ? 'Scheduled upcoming' : 'Never scheduled'),
    relativeTimeAgo,
    isRecent: false, // Disabling generic "sung recently" warning badge in favor of clean last sung history
    isInCooldown,
    cooldownMessage,
    totalCount: allDates.length,
    recentSetlistDate: lastDate || upcomingDate || undefined,
    upcomingDate,
  };
}

/**
 * Compute the usage history and repetition warning for a song
 */
export function getSongUsageHistory(songTitleOrId: string, setlists: Setlist[]): SongUsageHistory {
  if (!songTitleOrId || !songTitleOrId.trim()) {
    return {
      lastDate: null,
      formattedLastDate: null,
      relativeTimeAgo: null,
      isRecent: false,
      isInCooldown: false,
      totalCount: 0,
    };
  }

  const map = buildSongUsageMap(setlists);
  return getSongUsageHistoryFromMap(songTitleOrId, map);
}
