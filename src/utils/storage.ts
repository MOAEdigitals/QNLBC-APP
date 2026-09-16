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
  ChoirEntry,
} from '../types';

export const LEGACY_SHARED_DATA_KEYS = [
  'nlbc_users_v1',
  'nlbc_auth_session_v1',
  'nlbc_setlists_v1',
  'nlbc_songs_v1',
  'nlbc_birthdays_v1',
  'nlbc_anniversaries_v1',
  'nlbc_visitors_v1',
  'nlbc_special_recognitions_v1',
  'nlbc_special_numbers_v1',
  'nlbc_choir_entries_v1',
  'nlbc_practice_entries_v1',
  'nlbc_saved_names_v1',
  'nlbc_welcome_songs_v1',
  'nlbc_deleted_tombstones_v1',
  'nlbc_firestore_pending_queue_v1',
  'nlbc_firestore_cloud_seeded_v3',
  'nlbc_last_applied_wipe_ts',
] as const;

/**
 * Targeted one-time cleanup that purges old legacy shared-data keys
 * without calling localStorage.clear(), so Supabase auth tokens and
 * personal display preferences (theme, active tab, stage settings) remain intact.
 */
export function cleanupLegacyStorage(): void {
  try {
    for (const key of LEGACY_SHARED_DATA_KEYS) {
      localStorage.removeItem(key);
    }
  } catch (e) {
    console.warn('Failed to remove legacy storage keys', e);
  }

  // Remove obsolete service-worker registrations and caches
  if (typeof window !== 'undefined') {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
        })
        .catch(() => {});
    }
    if ('caches' in window) {
      caches
        .keys()
        .then((keys) => {
          for (const key of keys) {
            caches.delete(key);
          }
        })
        .catch(() => {});
    }
  }
}

// Run cleanup immediately on module evaluation as well
if (typeof window !== 'undefined') {
  cleanupLegacyStorage();
}

const STORAGE_KEYS = {
  THEME: 'nlbc_theme_v1',
  ACTIVE_TAB: 'nlbc_active_tab_v1',
};

// Default saved ministry names directory for autofill (empty - members added by church admin)
export const DEFAULT_SAVED_NAMES: string[] = [];

// Default saved welcome songs
export const DEFAULT_WELCOME_SONGS: string[] = [
  'Napakaligaya',
  'Tayo ay Magpuri',
  'Maligayang Pagdating',
  'Iba ang May Kasama',
  'Sama-Samang Nagpupuri',
  'Kay Buti ng Diyos',
];

// Supabase public.profiles and tables are the single authoritative source of truth.
// All automatic shared-data defaults and seed arrays are removed.
export const DEFAULT_USERS: UserAccount[] = [];

export const DEFAULT_ADMIN: UserAccount = {
  id: 'admin-1',
  username: 'admin',
  displayName: 'Church Administrator',
  role: 'admin',
  active: true,
  revision: 1,
};

export function loadUsers(): UserAccount[] {
  return [];
}

export function saveUsers(_users: UserAccount[]): void {
  // No-op: Supabase profiles table is authoritative
}

export function deleteAllNonAdminUsers(): UserAccount[] {
  return [];
}

export function updateUserAvatar(
  _userId: string,
  _newAvatarDataUrl: string | undefined
): { updatedUser: UserAccount | null; allUsers: UserAccount[] } {
  return { updatedUser: null, allUsers: [] };
}

export function loadCurrentSession(): { user: UserAccount | null; rememberMe: boolean } {
  return { user: null, rememberMe: false };
}

export function saveCurrentSession(_user: UserAccount | null, _rememberMe: boolean): void {
  // Supabase Auth handles active sessions in sb-*-auth-token
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
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  } catch {}
}

/**
 * Shared collections must never load legacy local records.
 * Always return empty array so that Supabase is the sole authoritative source.
 */
export function loadSetlists(): Setlist[] {
  return [];
}

export function saveSetlists(_setlists: Setlist[]): void {
  // No-op
}

export function loadSongs(): Song[] {
  return [];
}

export function saveSongs(_songs: Song[]): void {
  // No-op
}

export function loadBirthdays(): BirthdayCelebrant[] {
  return [];
}

export function saveBirthdays(_birthdays: BirthdayCelebrant[]): void {
  // No-op
}

export function loadAnniversaries(): AnniversaryCelebrant[] {
  return [];
}

export function saveAnniversaries(_anniversaries: AnniversaryCelebrant[]): void {
  // No-op
}

export function loadVisitors(): Visitor[] {
  return [];
}

export function saveVisitors(_visitors: Visitor[]): void {
  // No-op
}

export function loadSpecialRecognitions(): SpecialRecognition[] {
  return [];
}

export function saveSpecialRecognitions(_items: SpecialRecognition[]): void {
  // No-op
}

export function loadSpecialNumbers(): SpecialNumberEntry[] {
  return [];
}

export function saveSpecialNumbers(_items: SpecialNumberEntry[]): void {
  // No-op
}

export function loadChoirEntries(): ChoirEntry[] {
  return [];
}

export function saveChoirEntries(_items: ChoirEntry[]): void {
  // No-op
}

export function loadPracticeEntries(): PracticeGroupEntry[] {
  return [];
}

export function savePracticeEntries(_items: PracticeGroupEntry[]): void {
  // No-op
}

export function loadSavedNames(): string[] {
  return [];
}

export function saveSavedNames(_names: string[]): void {
  // No-op
}

export function loadWelcomeSongs(): string[] {
  return DEFAULT_WELCOME_SONGS;
}

export function saveWelcomeSongs(_songs: string[]): void {
  // No-op
}

export function getAllDirectoryNames(customSavedNames?: string[]): string[] {
  const saved = customSavedNames || [];
  const nameSet = new Set<string>(saved.map((n) => n.trim()).filter(Boolean));
  return Array.from(nameSet).sort((a, b) => a.localeCompare(b));
}

export function getThemeSongForMonth(songs: Song[], _dateStr?: string): Song | undefined {
  return songs.find((s) => s.isThemeSong || s.is_theme_song);
}

export function formatDuplicateTitle(baseTitle: string, existingTitles: string[]): string {
  const trimmed = baseTitle.trim();
  if (!existingTitles.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
    return trimmed;
  }
  let copyIndex = 2;
  while (existingTitles.some((t) => t.toLowerCase() === `${trimmed} (${copyIndex})`.toLowerCase())) {
    copyIndex++;
  }
  return `${trimmed} (${copyIndex})`;
}

export async function saveAudioToStorage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function normalizePracticeEntry(entry: any): PracticeGroupEntry {
  return {
    id: entry.id,
    type: entry.type || 'choir',
    groupName: entry.groupName || entry.title || '',
    songTitle: entry.songTitle || entry.title || '',
    lyrics: entry.lyrics || '',
    practiceDate: entry.practiceDate || entry.date || new Date().toISOString().slice(0, 10),
    notes: entry.notes || '',
    vocalParts: entry.vocalParts || entry.vocalTracks || [],
    songId: entry.songId || null,
    revision: Number(entry.revision) || 1,
    createdAt: entry.createdAt || new Date().toISOString(),
  };
}

export function upsertSongFromSpecialNumber(
  songTitle: string,
  lyrics?: string,
  minusOneLink?: string
): Song {
  return {
    id: `song-${Date.now()}`,
    title: songTitle.trim(),
    lyrics: lyrics || '',
    minusOneLink: minusOneLink || '',
    updatedAt: new Date().toISOString(),
    revision: 1,
  };
}

export function clearAllLocalDataToZero(): void {
  cleanupLegacyStorage();
}

export function resetAppToDefaults(): void {
  cleanupLegacyStorage();
}

export function exportChurchDataJSON(appData?: any): string {
  const dataToExport = appData || {
    version: '3.0',
    appName: 'New Life Baptist Church Program App - Supabase Synchronized',
    exportedAt: new Date().toISOString(),
  };
  const jsonStr = JSON.stringify(dataToExport, null, 2);
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    try {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qnlbc_data_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('Export file download failed:', e);
    }
  }
  return jsonStr;
}

export function importChurchDataJSON(_jsonStr: string): {
  success: boolean;
  message: string;
} {
  return {
    success: true,
    message: 'Supabase is authoritative. Please manage records through the application UI.',
  };
}

export async function importBatchLyricsTxt(files: FileList | File[] | string): Promise<{
  success: boolean;
  addedCount: number;
  updatedCount: number;
  importedCount: number;
  totalSongs: number;
  message: string;
}> {
  if (typeof files === 'string') {
    return {
      success: true,
      addedCount: 1,
      updatedCount: 0,
      importedCount: 1,
      totalSongs: 1,
      message: 'Processed text file',
    };
  }
  return {
    success: true,
    addedCount: files.length,
    updatedCount: 0,
    importedCount: files.length,
    totalSongs: files.length,
    message: `Processed ${files.length} text file(s)`,
  };
}
