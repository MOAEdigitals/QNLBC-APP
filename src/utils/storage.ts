import {
  UserAccount,
  Setlist,
  Song,
  BirthdayCelebrant,
  AnniversaryCelebrant,
  Visitor,
  SpecialRecognition,
  SpecialNumberEntry,
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
};

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
];

// Helper to seed dynamic current dates
function getInitialData() {
  const nextSunday = getNextSundayStr();
  const nextSundayDate = new Date(nextSunday);
  
  // A future sunday after next
  const followingSunday = new Date(nextSundayDate);
  followingSunday.setDate(followingSunday.getDate() + 7);
  const followingSundayStr = followingSunday.toISOString().split('T')[0];

  // A past sunday
  const pastSunday = new Date(nextSundayDate);
  pastSunday.setDate(pastSunday.getDate() - 7);
  const pastSundayStr = pastSunday.toISOString().split('T')[0];

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const currentDay = String(now.getDate()).padStart(2, '0');

  const initialSetlists: Setlist[] = [
    {
      id: 'setlist-next',
      date: nextSunday,
      presider: 'Ptr. Jonathan Santos',
      sundaySchool: {
        songLeader: 'Bro. Christian Ramos',
        songs: [
          { id: 'ss-s1', songId: 'song-3', title: 'Amazing Grace (My Chains Are Gone)', keyNote: 'Key of G', notes: 'Warm acoustic start' },
          { id: 'ss-s2', songId: 'song-4', title: 'Salamat Panginoon', keyNote: 'Key of C', notes: 'With Sunday School children clapping' },
        ],
        notes: 'Adult class & Youth combined study at 9:00 AM',
      },
      worshipService: {
        songLeader: 'Sis. Abigail Cruz',
        songs: [
          { id: 'ws-s1', songId: 'song-1', title: 'Dakilang Katapatan', keyNote: 'Key of D', notes: 'Opening praise hymn' },
          { id: 'ws-s2', songId: 'song-2', title: '10,000 Reasons (Bless The Lord)', keyNote: 'Key of G', notes: 'Congregational singing' },
          { id: 'ws-s3', songId: 'song-5', title: 'Goodness of God', keyNote: 'Key of A', notes: 'Prayer response worship' },
        ],
        notes: 'Theme: Faithfulness in Season and Out of Season',
      },
      generalNotes: 'Communion preparation by Deaconess team after worship.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'setlist-following',
      date: followingSundayStr,
      presider: 'Bro. Emmanuel Garcia',
      sundaySchool: {
        songLeader: 'Sis. Kimberly Dela Cruz',
        songs: [
          { id: 'ss-f1', songId: 'song-4', title: 'Salamat Panginoon', keyNote: 'Key of C' },
          { id: 'ss-f2', songId: 'song-6', title: 'How Great Thou Art', keyNote: 'Key of Bb' },
        ],
      },
      worshipService: {
        songLeader: 'Bro. Mark Villanueva',
        songs: [
          { id: 'ws-f1', songId: 'song-1', title: 'Dakilang Katapatan', keyNote: 'Key of D' },
          { id: 'ws-f2', songId: 'song-5', title: 'Goodness of God', keyNote: 'Key of A' },
          { id: 'ws-f3', songId: 'song-2', title: '10,000 Reasons (Bless The Lord)', keyNote: 'Key of G' },
        ],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'setlist-past',
      date: pastSundayStr,
      presider: 'Bro. Roberto Mendoza',
      sundaySchool: {
        songLeader: 'Sis. Grace David',
        songs: [
          { id: 'ss-p1', songId: 'song-3', title: 'Amazing Grace', keyNote: 'Key of G' },
          { id: 'ss-p2', songId: 'song-6', title: 'How Great Thou Art', keyNote: 'Key of Bb' },
        ],
      },
      worshipService: {
        songLeader: 'Bro. Daniel Pascual',
        songs: [
          { id: 'ws-p1', songId: 'song-1', title: 'Dakilang Katapatan', keyNote: 'Key of D' },
          { id: 'ws-p2', songId: 'song-4', title: 'Salamat Panginoon', keyNote: 'Key of C' },
        ],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  // Birthday date falling in current week
  const bdayThisWeek = `${currentYear}-${currentMonth}-${currentDay}`;
  const bdayNextMonth = `${currentYear}-${String((now.getMonth() + 2) > 12 ? 1 : now.getMonth() + 2).padStart(2, '0')}-15`;

  const initialBirthdays: BirthdayCelebrant[] = [
    {
      id: 'bday-1',
      name: 'Sis. Elena Morales',
      birthDate: bdayThisWeek,
      ministryOrGroup: "Women's Ministry",
      notes: 'Happy birthday! God bless your family.',
    },
    {
      id: 'bday-2',
      name: 'Bro. Joshua Fernando',
      birthDate: `${currentYear}-${currentMonth}-28`,
      ministryOrGroup: 'Youth Fellowship',
      notes: 'Active praise team drummer',
    },
    {
      id: 'bday-3',
      name: 'Nanay Corazon Del Rosario',
      birthDate: bdayNextMonth,
      ministryOrGroup: 'Senior Fellowship',
    },
    {
      id: 'bday-4',
      name: 'Bro. Samuel Mateo',
      birthDate: `${currentYear}-10-12`,
      ministryOrGroup: "Men's Ministry",
    },
  ];

  const initialAnniversaries: AnniversaryCelebrant[] = [
    {
      id: 'anniv-1',
      title: 'Bro. Roberto & Sis. Carmen Mendoza',
      anniversaryDate: bdayThisWeek,
      type: 'Wedding',
      yearsCount: 28,
      notes: '28 years of God-honoring marriage',
    },
    {
      id: 'anniv-2',
      title: 'New Life Baptist Church (Quezon, NE)',
      anniversaryDate: `${currentYear}-09-18`,
      type: 'Church',
      yearsCount: 34,
      notes: '34th Founding & Thanksgiving Anniversary Celebration',
    },
    {
      id: 'anniv-3',
      title: 'Bro. Alvin & Sis. Maricel Ramos',
      anniversaryDate: `${currentYear}-11-05`,
      type: 'Wedding',
      yearsCount: 15,
    },
  ];

  const initialVisitors: Visitor[] = [
    {
      id: 'vis-1',
      name: 'Karlo Bautista',
      barangay: 'Brgy. Dulong Bayan, Quezon',
      tier: '1st timer',
      dateVisited: pastSundayStr,
      notes: 'Invited by Bro. Christian. Appreciated the warm fellowship.',
    },
    {
      id: 'vis-2',
      name: 'Rowena & Angelo Corpuz',
      barangay: 'Brgy. San Alejandro, Quezon',
      tier: '2nd timer',
      dateVisited: pastSundayStr,
      notes: 'Attended worship service with their two children.',
    },
    {
      id: 'vis-3',
      name: 'Dennis Vergara',
      barangay: 'Brgy. Bertese, Quezon',
      tier: '3rd timer',
      dateVisited: pastSundayStr,
      notes: 'Joined Sunday school adult Bible study.',
    },
    {
      id: 'vis-4',
      name: 'Maricel & Noel Santos',
      barangay: 'Brgy. Sto. Tomas Ferreira, Quezon',
      tier: 'Regular attender',
      dateVisited: pastSundayStr,
      notes: 'Inquirers class candidate.',
    },
  ];

  const initialSpecialRecognitions: SpecialRecognition[] = [
    {
      id: 'spec-1',
      name: 'Sis. Clarisse Anne Gutierrez',
      recognitionType: 'Board Passer',
      customType: 'BLEPT (Licensure Exam for Teachers)',
      date: `${currentYear}-08-15`,
      description: 'Passed the Licensure Examination for Professional Teachers (Secondary Education - Major in English). Praise God!',
    },
    {
      id: 'spec-2',
      name: 'Bro. Jeremy Keith Pineda',
      recognitionType: 'Newly Graduated',
      customType: 'BS Information Technology, Magna Cum Laude',
      date: `${currentYear}-07-20`,
      description: 'Graduated with Latin honors from Central Luzon State University.',
    },
    {
      id: 'spec-3',
      name: 'Matthew David & Chloe Nicole',
      recognitionType: 'Newly Baptized',
      date: `${currentYear}-08-02`,
      description: 'Public declaration of faith through believer baptism by immersion at Quezon river fellowship.',
    },
    {
      id: 'spec-4',
      name: 'Bro. Timothy & Sis. Rachel Pascual',
      recognitionType: 'Newlywed',
      date: `${currentYear}-06-18`,
      description: 'United in holy matrimony officiated by Ptr. Jonathan.',
    },
  ];

  const initialSpecialNumbers: SpecialNumberEntry[] = [
    {
      id: 'sp-1',
      performerName: 'NLBC Youth Choir',
      scheduledDate: nextSunday,
      songTitle: 'Dakilang Katapatan',
      songId: 'song-1',
      minusOneLink: 'https://www.youtube.com/watch?v=dakilang_katapatan_backing_track',
      notes: 'Practice on Saturday at 4:00 PM in church sanctuary',
      lyrics: INITIAL_SONGS[0].lyrics,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'sp-2',
      performerName: 'Sis. Abigail Cruz (Solo)',
      scheduledDate: followingSundayStr,
      songTitle: 'Goodness of God',
      songId: 'song-5',
      minusOneLink: 'https://www.youtube.com/watch?v=goodness_of_god_instrumental',
      notes: 'Acoustic guitar backing by Bro. Mark',
      lyrics: INITIAL_SONGS[4].lyrics,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'sp-3',
      performerName: 'Men of Honor Quartet',
      scheduledDate: pastSundayStr,
      songTitle: 'How Great Thou Art',
      songId: 'song-6',
      notes: 'A cappella 4-part harmony',
      lyrics: INITIAL_SONGS[5].lyrics,
      createdAt: new Date().toISOString(),
    },
  ];

  return {
    initialSetlists,
    initialBirthdays,
    initialAnniversaries,
    initialVisitors,
    initialSpecialRecognitions,
    initialSpecialNumbers,
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

export function loadSetlists(): Setlist[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETLISTS);
    if (!raw) {
      const { initialSetlists } = getInitialData();
      localStorage.setItem(STORAGE_KEYS.SETLISTS, JSON.stringify(initialSetlists));
      return initialSetlists;
    }
    return JSON.parse(raw);
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
      const { initialBirthdays } = getInitialData();
      localStorage.setItem(STORAGE_KEYS.BIRTHDAYS, JSON.stringify(initialBirthdays));
      return initialBirthdays;
    }
    return JSON.parse(raw);
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
      const { initialAnniversaries } = getInitialData();
      localStorage.setItem(STORAGE_KEYS.ANNIVERSARIES, JSON.stringify(initialAnniversaries));
      return initialAnniversaries;
    }
    return JSON.parse(raw);
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
      const { initialVisitors } = getInitialData();
      localStorage.setItem(STORAGE_KEYS.VISITORS, JSON.stringify(initialVisitors));
      return initialVisitors;
    }
    return JSON.parse(raw);
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
      const { initialSpecialRecognitions } = getInitialData();
      localStorage.setItem(STORAGE_KEYS.SPECIAL_RECOGNITIONS, JSON.stringify(initialSpecialRecognitions));
      return initialSpecialRecognitions;
    }
    return JSON.parse(raw);
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
      const { initialSpecialNumbers } = getInitialData();
      localStorage.setItem(STORAGE_KEYS.SPECIAL_NUMBERS, JSON.stringify(initialSpecialNumbers));
      return initialSpecialNumbers;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveSpecialNumbers(items: SpecialNumberEntry[]): void {
  localStorage.setItem(STORAGE_KEYS.SPECIAL_NUMBERS, JSON.stringify(items));
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
  getInitialData();
}

/**
 * Export full church data as JSON file
 */
export function exportChurchDataJSON(): string {
  const data = {
    appName: 'New Life Baptist Church Program App',
    exportedAt: new Date().toISOString(),
    setlists: loadSetlists(),
    songs: loadSongs(),
    birthdays: loadBirthdays(),
    anniversaries: loadAnniversaries(),
    visitors: loadVisitors(),
    specialRecognitions: loadSpecialRecognitions(),
    specialNumbers: loadSpecialNumbers(),
  };
  return JSON.stringify(data, null, 2);
}
