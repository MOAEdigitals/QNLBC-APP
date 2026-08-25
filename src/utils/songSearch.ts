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
  isRecent: boolean; // Sung in the last 14 days or last setlist
  totalCount: number;
  recentSetlistDate?: string;
}

// Global WeakMap / memoized map cache for setlists array reference
let cachedSetlistsRef: Setlist[] | null = null;
let cachedUsageMap: Map<string, string[]> = new Map();

/**
 * Pre-builds an O(1) lookup Map from normalized song title -> sorted date array.
 * This runs in <1ms and allows instant history lookups without looping.
 */
export function buildSongUsageMap(setlists: Setlist[]): Map<string, string[]> {
  if (!setlists || setlists.length === 0) return new Map();

  if (cachedSetlistsRef === setlists) {
    return cachedUsageMap;
  }

  const map = new Map<string, string[]>();

  const addEntry = (title: string | undefined, date: string) => {
    if (!title || !date) return;
    const key = normalizeForSearch(title);
    if (!key) return;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, [date]);
    } else {
      existing.push(date);
    }
  };

  for (const setlist of setlists) {
    const date = setlist.date;
    if (!date) continue;

    if (setlist.welcomeSong) addEntry(setlist.welcomeSong, date);
    if (setlist.closingSong) addEntry(setlist.closingSong, date);
    if (setlist.themeSong) addEntry(setlist.themeSong, date);

    if (setlist.sundaySchool?.songs) {
      for (const s of setlist.sundaySchool.songs) {
        if (s.title) addEntry(s.title, date);
      }
    }

    if (setlist.worshipService?.songs) {
      for (const s of setlist.worshipService.songs) {
        if (s.title) addEntry(s.title, date);
      }
    }

    if (setlist.program?.songs) {
      for (const s of setlist.program.songs) {
        if (s.title) addEntry(s.title, date);
      }
    }
  }

  // Sort dates descending for each song
  for (const dates of map.values()) {
    dates.sort((a, b) => b.localeCompare(a));
  }

  cachedSetlistsRef = setlists;
  cachedUsageMap = map;
  return map;
}

/**
 * Instant O(1) usage history lookup using pre-computed usage map
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
      totalCount: 0,
    };
  }

  const cleanTarget = normalizeForSearch(songTitleOrId);
  const matchedDates = usageMap.get(cleanTarget);

  if (!matchedDates || matchedDates.length === 0) {
    return {
      lastDate: null,
      formattedLastDate: 'Never scheduled',
      relativeTimeAgo: null,
      isRecent: false,
      totalCount: 0,
    };
  }

  const mostRecentDate = matchedDates[0];
  const todayDate = parseDate(todayStr);
  const recentDateObj = parseDate(mostRecentDate);
  const diffTime = todayDate.getTime() - recentDateObj.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  let relativeTimeAgo = '';
  if (diffDays < 0) {
    relativeTimeAgo = 'Scheduled upcoming';
  } else if (diffDays === 0) {
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

  const formattedDate = formatDateStr(mostRecentDate, { shortMonth: true });
  const isRecent = diffDays >= 0 && diffDays <= 14;

  return {
    lastDate: mostRecentDate,
    formattedLastDate: formattedDate,
    relativeTimeAgo,
    isRecent,
    totalCount: matchedDates.length,
    recentSetlistDate: mostRecentDate,
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
      totalCount: 0,
    };
  }

  const map = buildSongUsageMap(setlists);
  return getSongUsageHistoryFromMap(songTitleOrId, map);
}
