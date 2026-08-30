import {
  UserAccount,
  Setlist,
  Song,
  BirthdayCelebrant,
  AnniversaryCelebrant,
  Visitor,
  SpecialRecognition,
  SpecialNumberEntry,
  PracticeGroupEntry,
} from '../types';
import { getNextSundayStr } from './dateUtils';

const STORAGE_KEYS = {
  USERS: 'nlbc_users_v1',
  AUTH_SESSION: 'nlbc_auth_session_v1',
  THEME: 'nlbc_theme_v1',
  SETLISTS: 'nlbc_setlists_v1',
  SONGS: 'nlbc_songs_v1',
  BIRTHDAYS: 'nlbc_birthdays_v1',
  ANNIVERSARIES: 'nlbc_anniversaries_v1',
  VISITORS: 'nlbc_visitors_v1',
  SPECIAL_RECOGNITIONS: 'nlbc_special_recognitions_v1',
  SPECIAL_NUMBERS: 'nlbc_special_numbers_v1',
  PRACTICE_ENTRIES: 'nlbc_practice_entries_v1',
  SAVED_NAMES: 'nlbc_saved_names_v1',
  WELCOME_SONGS: 'nlbc_welcome_songs_v1',
};

// Default saved ministry names directory for autofill
export const DEFAULT_SAVED_NAMES: string[] = [
  'Ptr. Jonathan Santos',
  'Bro. Christian Ramos',
  'Sis. Abigail Cruz',
  'Bro. Mark Villanueva',
  'Bro. Emmanuel Garcia',
  'Sis. Kimberly Dela Cruz',
  'Bro. Daniel Pascual',
  'Sis. Grace David',
  'Bro. Roberto Mendoza',
  'Sis. Elena Morales',
  'Bro. Joshua Fernando',
  'Bro. Alvin Ramos',
  'Sis. Maricel Ramos',
  'Sis. Carmen Mendoza',
  'NLBC Youth Choir',
  'Men of Honor Quartet',
  'Junior Church Worship Team',
];

// Default saved welcome songs
export const DEFAULT_WELCOME_SONGS: string[] = [
  'Napakaligaya',
  'Tayo ay Magpuri',
  'Maligayang Pagdating',
  'Iba ang May Kasama',
  'Sama-Samang Nagpupuri',
  'Kay Buti ng Diyos',
];

// Default pre-seeded admin account per user spec
export const DEFAULT_ADMIN: UserAccount = {
  id: 'admin-qnlbc-root',
  username: 'QNLBC',
  passwordHash: 'qnlbc2026',
  role: 'admin',
  createdAt: '2026-01-01T00:00:00.000Z',
};

// Initial realistic songs library
const INITIAL_SONGS: Song[] = [
  {
    id: 'song-1',
    title: 'Dakilang Katapatan',
    artist: 'Papuri / Arnel De Pano',
    lyrics: `[Verse 1]
Sadyang kay buti ng ating Panginoon
Magtatapat sa habang panahon
Maging sa kabila ng ating pagkukulang
Biyaya Niya'y patuloy na bubuhos

[Verse 2]
Kailanma'y 'di Siya nagmaliw
Kahit anong tindi ng unos
Mananatiling tapat ang Panginoon
Magpakailanman

[Chorus]
Dakila Ka, O Diyos, tapat Ka ngang tunay
Magmula pa sa ugat ng aming buhay
Bawat umaga'y laging bago ang Iyong awa
Dakila ang Iyong katapatan
O Diyos, dakila Ka!`,
    minusOneLink: 'https://www.youtube.com/watch?v=dakilang_katapatan_backing_track',
    attachments: [
      {
        id: 'att-1',
        name: 'Chords Key of D.pdf',
        type: 'text',
        urlOrData: 'Verse: D - F#m - G - A | Chorus: G - A - F#m - Bm - Em - A - D',
        createdAt: '2026-08-01',
      },
    ],
    updatedAt: '2026-08-10',
  },
  {
    id: 'song-2',
    title: '10,000 Reasons (Bless The Lord)',
    artist: 'Matt Redman',
    lyrics: `[Chorus]
Bless the Lord, O my soul, O my soul
Worship His holy name
Sing like never before, O my soul
I'll worship Your holy name

[Verse 1]
The sun comes up, it's a new day dawning
It's time to sing Your song again
Whatever may pass, and whatever lies before me
Let me be singing when the evening comes

[Verse 2]
You're rich in love, and You're slow to anger
Your name is great, and Your heart is kind
For all Your goodness I will keep on singing
Ten thousand reasons for my heart to find`,
    minusOneLink: 'https://www.youtube.com/watch?v=10000reasons_instrumental',
    updatedAt: '2026-08-11',
  },
  {
    id: 'song-3',
    title: 'Amazing Grace (My Chains Are Gone)',
    artist: 'Chris Tomlin / John Newton',
    lyrics: `[Verse 1]
Amazing grace, how sweet the sound
That saved a wretch like me
I once was lost, but now I'm found
Was blind, but now I see

[Verse 2]
'Twas grace that taught my heart to fear
And grace my fears relieved
How precious did that grace appear
The hour I first believed

[Chorus]
My chains are gone, I've been set free
My God, my Savior has ransomed me
And like a flood His mercy reigns
Unending love, amazing grace`,
    minusOneLink: 'https://www.youtube.com/watch?v=amazing_grace_minus_one',
    updatedAt: '2026-08-12',
  },
  {
    id: 'song-4',
    title: 'Salamat Panginoon',
    artist: 'Rommel Guevara',
    lyrics: `[Verse]
Ikaw ay mabuti, bawat sandali
Sa habang buhay ay mananatili
Hindi Mo ako iniwan o pinabayaan man
Biyaya Mo't habag ay laging nariyan

[Chorus]
Salamat Panginoon sa Iyong kabutihan
Salamat Panginoon sa Iyong katapatan
Walang katulad ang pag-ibig Mo
Hesus, purihin Ka magpakailanman!`,
    minusOneLink: 'https://www.youtube.com/watch?v=salamat_panginoon_track',
    updatedAt: '2026-08-14',
  },
  {
    id: 'song-5',
    title: 'Goodness of God',
    artist: 'Bethel Music / Jenn Johnson',
    lyrics: `[Verse 1]
I love You, Lord, for Your mercy never fails me
All my days, I've been held in Your hands
From the moment that I wake up until I lay my head
Oh, I will sing of the goodness of God

[Chorus]
'Cause all my life You have been faithful
And all my life You have been so, so good
With every breath that I am able
Oh, I will sing of the goodness of God`,
    minusOneLink: 'https://www.youtube.com/watch?v=goodness_of_god_instrumental',
    updatedAt: '2026-08-15',
  },
  {
    id: 'song-6',
    title: 'How Great Thou Art',
    artist: 'Hymn / Stuart K. Hine',
    lyrics: `[Verse 1]
O Lord my God, when I in awesome wonder
Consider all the worlds Thy hands have made
I see the stars, I hear the rolling thunder
Thy power throughout the universe displayed

[Chorus]
Then sings my soul, my Savior God, to Thee
How great Thou art, how great Thou art!
Then sings my soul, my Savior God, to Thee
How great Thou art, how great Thou art!`,
    updatedAt: '2026-08-16',
  },
  {
    id: 'song-welcome-1',
    title: 'Napakaligaya',
    artist: 'Tagalog Praise',
    lyrics: `[Verse]
Napakaligaya at kahanga-hanga
Kung ang magkakapatid ay magkasama-sama
May pagkakaisa at pagmamahalan
Panginoon ay pinupuri magpakailanman!`,
    isWelcomeSong: true,
    updatedAt: '2026-08-18',
  },
  {
    id: 'song-closing-1',
    title: 'Give Thanks',
    artist: 'Don Moen / Henry Smith',
    lyrics: `[Verse]
Give thanks with a grateful heart
Give thanks to the Holy One
Give thanks because He's given Jesus Christ, His Son

[Chorus]
And now let the weak say, "I am strong"
Let the poor say, "I am rich
Because of what the Lord has done for us"
Give thanks!`,
    isClosingSong: true,
    updatedAt: '2026-08-18',
  },
];

// Helper for initial empty data state without generating dummy/example items
function getInitialData() {
  return {
    initialSetlists: [] as Setlist[],
    initialBirthdays: [] as BirthdayCelebrant[],
    initialAnniversaries: [] as AnniversaryCelebrant[],
    initialVisitors: [] as Visitor[],
    initialSpecialRecognitions: [] as SpecialRecognition[],
    initialSpecialNumbers: [] as SpecialNumberEntry[],
  };
}

export function loadUsers(): UserAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!raw) {
      const defaultList = [DEFAULT_ADMIN];
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(defaultList));
      return defaultList;
    }
    const parsed: UserAccount[] = JSON.parse(raw);
    if (!parsed.find((u) => u.username.toLowerCase() === DEFAULT_ADMIN.username.toLowerCase())) {
      parsed.unshift(DEFAULT_ADMIN);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(parsed));
    }
    return parsed;
  } catch {
    return [DEFAULT_ADMIN];
  }
}

export function saveUsers(users: UserAccount[]): void {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
}

export function updateUserAvatar(
  userId: string,
  newAvatarDataUrl: string | undefined
): { updatedUser: UserAccount | null; allUsers: UserAccount[] } {
  const users = loadUsers();
  const userIdx = users.findIndex((u) => u.id === userId);
  if (userIdx === -1) {
    return { updatedUser: null, allUsers: users };
  }

  const updatedUser: UserAccount = {
    ...users[userIdx],
    avatar: newAvatarDataUrl || undefined,
  };

  users[userIdx] = updatedUser;
  saveUsers(users);

  // If current session is this user, update session as well
  const currentSession = loadCurrentSession();
  if (currentSession.user && currentSession.user.id === userId) {
    saveCurrentSession(updatedUser, currentSession.rememberMe);
  }

  return { updatedUser, allUsers: users };
}

export function loadCurrentSession(): { user: UserAccount | null; rememberMe: boolean } {
  try {
    // Check localStorage (remembered) or sessionStorage
    const local = localStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
    if (local) {
      return { user: JSON.parse(local), rememberMe: true };
    }
    const session = sessionStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
    if (session) {
      return { user: JSON.parse(session), rememberMe: false };
    }
    return { user: null, rememberMe: false };
  } catch {
    return { user: null, rememberMe: false };
  }
}

export function saveCurrentSession(user: UserAccount | null, rememberMe: boolean): void {
  if (!user) {
    localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
    sessionStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
    return;
  }
  if (rememberMe) {
    localStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(user));
    sessionStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
  } else {
    sessionStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(user));
    localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
  }
}

export function loadTheme(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    if (saved === 'dark' || saved === 'light') return saved;
    return 'light';
  } catch {
    return 'light';
  }
}

export function saveTheme(theme: 'light' | 'dark'): void {
  localStorage.setItem(STORAGE_KEYS.THEME, theme);
}

const LEGACY_MOCK_IDS = new Set([
  'setlist-next',
  'setlist-following',
  'setlist-past',
  'sp-1',
  'sp-2',
  'sp-3',
  'prac-1',
  'prac-2',
  'bday-1',
  'bday-2',
  'bday-3',
  'bday-4',
  'anniv-1',
  'anniv-2',
  'anniv-3',
  'vis-1',
  'vis-2',
  'vis-3',
  'vis-4',
  'spec-1',
  'spec-2',
  'spec-3',
  'spec-4',
]);

export function loadSetlists(): Setlist[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETLISTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.SETLISTS, JSON.stringify([]));
      return [];
    }
    const parsed: Setlist[] = JSON.parse(raw);
    const cleaned = parsed.filter((s) => !LEGACY_MOCK_IDS.has(s.id));
    if (cleaned.length !== parsed.length) {
      saveSetlists(cleaned);
    }
    return cleaned;
  } catch {
    return [];
  }
}

export function saveSetlists(setlists: Setlist[]): void {
  localStorage.setItem(STORAGE_KEYS.SETLISTS, JSON.stringify(setlists));
}

export function loadSongs(): Song[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SONGS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.SONGS, JSON.stringify(INITIAL_SONGS));
      return INITIAL_SONGS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_SONGS;
  }
}

export function saveSongs(songs: Song[]): void {
  localStorage.setItem(STORAGE_KEYS.SONGS, JSON.stringify(songs));
}

export function loadBirthdays(): BirthdayCelebrant[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BIRTHDAYS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.BIRTHDAYS, JSON.stringify([]));
      return [];
    }
    const parsed: BirthdayCelebrant[] = JSON.parse(raw);
    const cleaned = parsed.filter((b) => !LEGACY_MOCK_IDS.has(b.id));
    if (cleaned.length !== parsed.length) {
      saveBirthdays(cleaned);
    }
    return cleaned;
  } catch {
    return [];
  }
}

export function saveBirthdays(birthdays: BirthdayCelebrant[]): void {
  localStorage.setItem(STORAGE_KEYS.BIRTHDAYS, JSON.stringify(birthdays));
}

export function loadAnniversaries(): AnniversaryCelebrant[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ANNIVERSARIES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.ANNIVERSARIES, JSON.stringify([]));
      return [];
    }
    const parsed: AnniversaryCelebrant[] = JSON.parse(raw);
    const cleaned = parsed.filter((a) => !LEGACY_MOCK_IDS.has(a.id));
    if (cleaned.length !== parsed.length) {
      saveAnniversaries(cleaned);
    }
    return cleaned;
  } catch {
    return [];
  }
}

export function saveAnniversaries(anniversaries: AnniversaryCelebrant[]): void {
  localStorage.setItem(STORAGE_KEYS.ANNIVERSARIES, JSON.stringify(anniversaries));
}

export function loadVisitors(): Visitor[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.VISITORS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.VISITORS, JSON.stringify([]));
      return [];
    }
    const parsed: Visitor[] = JSON.parse(raw);
    const cleaned = parsed.filter((v) => !LEGACY_MOCK_IDS.has(v.id));
    if (cleaned.length !== parsed.length) {
      saveVisitors(cleaned);
    }
    return cleaned;
  } catch {
    return [];
  }
}

export function saveVisitors(visitors: Visitor[]): void {
  localStorage.setItem(STORAGE_KEYS.VISITORS, JSON.stringify(visitors));
}

export function loadSpecialRecognitions(): SpecialRecognition[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SPECIAL_RECOGNITIONS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.SPECIAL_RECOGNITIONS, JSON.stringify([]));
      return [];
    }
    const parsed: SpecialRecognition[] = JSON.parse(raw);
    const cleaned = parsed.filter((r) => !LEGACY_MOCK_IDS.has(r.id));
    if (cleaned.length !== parsed.length) {
      saveSpecialRecognitions(cleaned);
    }
    return cleaned;
  } catch {
    return [];
  }
}

export function saveSpecialRecognitions(items: SpecialRecognition[]): void {
  localStorage.setItem(STORAGE_KEYS.SPECIAL_RECOGNITIONS, JSON.stringify(items));
}

export function loadSpecialNumbers(): SpecialNumberEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SPECIAL_NUMBERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.SPECIAL_NUMBERS, JSON.stringify([]));
      return [];
    }
    const parsed: SpecialNumberEntry[] = JSON.parse(raw);
    const cleaned = parsed.filter((s) => !LEGACY_MOCK_IDS.has(s.id));
    if (cleaned.length !== parsed.length) {
      saveSpecialNumbers(cleaned);
    }
    return cleaned;
  } catch {
    return [];
  }
}

export function saveSpecialNumbers(items: SpecialNumberEntry[]): void {
  localStorage.setItem(STORAGE_KEYS.SPECIAL_NUMBERS, JSON.stringify(items));
}

export function loadSavedNames(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVED_NAMES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.SAVED_NAMES, JSON.stringify(DEFAULT_SAVED_NAMES));
      return DEFAULT_SAVED_NAMES;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_SAVED_NAMES;
  }
}

export function saveSavedNames(names: string[]): void {
  localStorage.setItem(STORAGE_KEYS.SAVED_NAMES, JSON.stringify(names));
}

export function loadWelcomeSongs(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.WELCOME_SONGS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.WELCOME_SONGS, JSON.stringify(DEFAULT_WELCOME_SONGS));
      return DEFAULT_WELCOME_SONGS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_WELCOME_SONGS;
  }
}

export function saveWelcomeSongs(songs: string[]): void {
  localStorage.setItem(STORAGE_KEYS.WELCOME_SONGS, JSON.stringify(songs));
}

/**
 * Returns names strictly from the Church Directory and autofill suggestions from Settings
 */
export function getAllDirectoryNames(): string[] {
  const saved = loadSavedNames();
  const nameSet = new Set<string>(saved.map((n) => n.trim()).filter(Boolean));
  return Array.from(nameSet).sort((a, b) => a.localeCompare(b));
}

/**
 * Month Theme Song Rule:
 * The first theme song scheduled for the first Sunday of the month will auto-populate
 * for all upcoming setlists within that same month and year.
 */
export function getThemeSongForMonth(setlists: Setlist[], targetDateStr: string): string {
  if (!targetDateStr) return '';
  const [year, month] = targetDateStr.split('-');
  if (!year || !month) return '';

  const prefix = `${year}-${month}`;
  // Find setlists in that month sorted by date ascending
  const monthSetlists = setlists
    .filter((s) => s.date.startsWith(prefix) && (!s.type || s.type === 'sunday'))
    .sort((a, b) => a.date.localeCompare(b.date));

  const firstSunday = monthSetlists.find((s) => s.themeSong?.trim());
  return firstSunday?.themeSong?.trim() || '';
}

/**
 * Formats duplicate song titles with # count if identical title exists with different ID or lyrics
 */
export function formatDuplicateTitle(baseTitle: string, existingSongs: Song[], currentSongId?: string): string {
  const cleanBase = baseTitle.trim().replace(/\s*\(\d+\)$/, '').trim();
  const sameTitles = existingSongs.filter(
    (s) => s.id !== currentSongId && s.title.trim().toLowerCase().startsWith(cleanBase.toLowerCase())
  );
  if (sameTitles.length === 0) return baseTitle.trim();
  return `${cleanBase} (${sameTitles.length + 1})`;
}

/**
 * Synchronizes or creates a Song in the Song Library when special number lyrics/song title are provided.
 */
export function upsertSongFromSpecialNumber(songTitle: string, lyrics: string, minusOneLink?: string): Song {
  const currentSongs = loadSongs();
  const normalizedTitle = songTitle.trim().toLowerCase();
  const existingIndex = currentSongs.findIndex((s) => s.title.trim().toLowerCase() === normalizedTitle);

  if (existingIndex >= 0) {
    const updated = {
      ...currentSongs[existingIndex],
      lyrics: lyrics || currentSongs[existingIndex].lyrics,
      minusOneLink: minusOneLink || currentSongs[existingIndex].minusOneLink,
      updatedAt: new Date().toISOString(),
    };
    currentSongs[existingIndex] = updated;
    saveSongs(currentSongs);
    return updated;
  } else {
    // If not existing, add to song library
    const newSong: Song = {
      id: `song-${Date.now()}`,
      title: songTitle.trim(),
      lyrics: lyrics || '',
      minusOneLink: minusOneLink || '',
      updatedAt: new Date().toISOString(),
    };
    currentSongs.push(newSong);
    saveSongs(currentSongs);
    return newSong;
  }
}

/**
 * Reset all data to default samples
 */
export function resetAppToDefaults(): void {
  localStorage.clear();
  sessionStorage.clear();
  loadUsers();
  loadSongs();
  loadSavedNames();
  loadWelcomeSongs();
  getInitialData();
}

/**
 * Export full church data as JSON file
 */
export function exportChurchDataJSON(): string {
  const data = {
    version: '2.0',
    appName: 'New Life Baptist Church Program App - Full Backup',
    exportedAt: new Date().toISOString(),
    setlists: loadSetlists(),
    songs: loadSongs(),
    birthdays: loadBirthdays(),
    anniversaries: loadAnniversaries(),
    visitors: loadVisitors(),
    specialRecognitions: loadSpecialRecognitions(),
    specialNumbers: loadSpecialNumbers(),
    savedNames: loadSavedNames(),
    welcomeSongs: loadWelcomeSongs(),
  };
  return JSON.stringify(data, null, 2);
}

/**
 * Imports and restores all tables from an exported JSON backup
 */
export function importChurchDataJSON(jsonStr: string): {
  success: boolean;
  message: string;
  stats?: {
    setlists: number;
    songs: number;
    birthdays: number;
    anniversaries: number;
    visitors: number;
    specialRecognitions: number;
    specialNumbers: number;
  };
} {
  try {
    const parsed = JSON.parse(jsonStr);

    if (Array.isArray(parsed.setlists)) {
      saveSetlists(parsed.setlists);
    }
    if (Array.isArray(parsed.songs)) {
      saveSongs(parsed.songs);
    }
    if (Array.isArray(parsed.birthdays)) {
      saveBirthdays(parsed.birthdays);
    }
    if (Array.isArray(parsed.anniversaries)) {
      saveAnniversaries(parsed.anniversaries);
    }
    if (Array.isArray(parsed.visitors)) {
      saveVisitors(parsed.visitors);
    }
    if (Array.isArray(parsed.specialRecognitions)) {
      saveSpecialRecognitions(parsed.specialRecognitions);
    }
    if (Array.isArray(parsed.specialNumbers)) {
      saveSpecialNumbers(parsed.specialNumbers);
    }
    if (Array.isArray(parsed.savedNames)) {
      saveSavedNames(parsed.savedNames);
    }
    if (Array.isArray(parsed.welcomeSongs)) {
      saveWelcomeSongs(parsed.welcomeSongs);
    }

    const stats = {
      setlists: parsed.setlists?.length || 0,
      songs: parsed.songs?.length || 0,
      birthdays: parsed.birthdays?.length || 0,
      anniversaries: parsed.anniversaries?.length || 0,
      visitors: parsed.visitors?.length || 0,
      specialRecognitions: parsed.specialRecognitions?.length || 0,
      specialNumbers: parsed.specialNumbers?.length || 0,
    };

    return {
      success: true,
      message: `Data successfully loaded! Restored ${stats.setlists} setlists, ${stats.songs} songs, ${stats.specialNumbers} special numbers, and all recognitions.`,
      stats,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to restore backup: ${err.message || 'Invalid JSON format'}`,
    };
  }
}

/**
 * Batch import lyrics from text files (.txt).
 * 1 txt file = 1 song.
 * Title of the song is the name of the text file (without .txt).
 * File content is the song lyrics.
 */
export function importBatchLyricsTxt(files: { fileName: string; content: string }[]): {
  importedCount: number;
  updatedCount: number;
  totalSongs: number;
} {
  const currentSongs = loadSongs();
  let importedCount = 0;
  let updatedCount = 0;

  files.forEach((file) => {
    // Strip .txt extension and trim title
    const songTitle = file.fileName.replace(/\.txt$/i, '').trim();
    if (!songTitle) return;
    const lyrics = file.content.trim();

    const existingIdx = currentSongs.findIndex(
      (s) => s.title.trim().toLowerCase() === songTitle.toLowerCase()
    );

    if (existingIdx >= 0) {
      currentSongs[existingIdx] = {
        ...currentSongs[existingIdx],
        lyrics: lyrics || currentSongs[existingIdx].lyrics,
        updatedAt: new Date().toISOString(),
      };
      updatedCount++;
    } else {
      currentSongs.push({
        id: `song-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: songTitle,
        lyrics: lyrics,
        updatedAt: new Date().toISOString(),
      });
      importedCount++;
    }
  });

  saveSongs(currentSongs);
  return {
    importedCount,
    updatedCount,
    totalSongs: currentSongs.length,
  };
}

// Initial starter Practice Group songs (empty by default - no example items injected)
export const DEFAULT_PRACTICE_ENTRIES: PracticeGroupEntry[] = [];

export function normalizePracticeEntry(entry: PracticeGroupEntry): PracticeGroupEntry {
  const customAttachments = (entry.customAttachments || entry.attachments || []).map((att) => ({
    ...att,
    url: att.url || att.urlOrData || '',
    category: att.category || 'minus_one',
  }));

  const vocalParts = (entry.vocalParts || entry.parts || []).map((p) => {
    const assigned = Array.isArray(p.assignedUsers) && p.assignedUsers.length > 0
      ? p.assignedUsers
      : p.assignedTo
      ? [p.assignedTo]
      : [];

    let audioUrl = p.audioUrl || p.urlOrData || '';
    if (audioUrl === 'indexeddb:local_storage' && p.id) {
      audioUrl = `indexeddb:${p.id}`;
    }

    return {
      ...p,
      partLabel: p.partLabel || 'Soprano',
      assignedUsers: assigned,
      assignedTo: assigned.join(', '),
      audioUrl,
    };
  });

  return {
    ...entry,
    customAttachments,
    attachments: customAttachments,
    vocalParts,
    parts: vocalParts,
  };
}

export function loadPracticeEntries(): PracticeGroupEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PRACTICE_ENTRIES);
    if (!raw) {
      savePracticeEntries([]);
      return [];
    }
    const parsed: PracticeGroupEntry[] = JSON.parse(raw);
    const cleaned = parsed.filter((p) => !LEGACY_MOCK_IDS.has(p.id));
    if (cleaned.length !== parsed.length) {
      savePracticeEntries(cleaned);
    }
    return cleaned.map(normalizePracticeEntry);
  } catch (err) {
    console.error('Error loading practice entries:', err);
    return [];
  }
}

export function savePracticeEntries(entries: PracticeGroupEntry[]): void {
  try {
    const normalized = entries.map(normalizePracticeEntry);

    // Sanitize heavy base64 strings before storing in localStorage to prevent Aw Snap crashes & quota overflow
    const safeForStorage = normalized.map((entry) => ({
      ...entry,
      vocalParts: (entry.vocalParts || []).map((vp) => {
        if (vp.audioUrl && vp.audioUrl.length > 1000 && vp.audioUrl.startsWith('data:')) {
          return { ...vp, audioUrl: `indexeddb:${vp.id}` };
        }
        return vp;
      }),
      parts: (entry.parts || []).map((vp) => {
        if (vp.audioUrl && vp.audioUrl.length > 1000 && vp.audioUrl.startsWith('data:')) {
          return { ...vp, audioUrl: `indexeddb:${vp.id}` };
        }
        return vp;
      }),
      customAttachments: (entry.customAttachments || []).map((att) => {
        if (att.url && att.url.length > 1000 && att.url.startsWith('data:')) {
          return { ...att, url: `indexeddb:${att.id}` };
        }
        return att;
      }),
      attachments: (entry.attachments || []).map((att) => {
        if (att.url && att.url.length > 1000 && att.url.startsWith('data:')) {
          return { ...att, url: `indexeddb:${att.id}` };
        }
        return att;
      }),
    }));

    localStorage.setItem(STORAGE_KEYS.PRACTICE_ENTRIES, JSON.stringify(safeForStorage));
  } catch (err) {
    console.error('Error saving practice entries:', err);
  }
}

export {
  saveAudioToStorage,
  getAudioFromStorage,
  deleteAudioFromStorage,
  subscribeToAudioUpdates,
} from './audioStorage';


