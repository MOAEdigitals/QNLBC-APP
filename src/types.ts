export type UserRole = 'admin' | 'user';

export interface UserAccount {
  id: string;
  username: string;
  name?: string;
  displayName?: string;
  display_name?: string;
  role: UserRole;
  active: boolean;
  avatar?: string;
  avatarUrl?: string;
  avatar_url?: string | null;
  passwordHash?: string;
  revision?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type UserProfile = UserAccount;

export type AttachmentCategory = 'plus_one' | 'minus_one';

export interface SongAttachment {
  id: string;
  name: string;
  category?: AttachmentCategory;
  type: 'link' | 'audio' | 'video' | 'image' | 'text' | 'file';
  urlOrData?: string;
  url?: string;
  uploadedAt?: string;
  createdAt?: string;
}

export interface Song {
  id: string;
  title: string;
  artist?: string;
  category?: string;
  categories?: string[];
  lyrics: string;
  minusOneLink?: string;
  minus_one_link?: string;
  attachments?: SongAttachment[];
  isWelcomeSong?: boolean;
  is_welcome_song?: boolean;
  isClosingSong?: boolean;
  is_closing_song?: boolean;
  isThemeSong?: boolean;
  is_theme_song?: boolean;
  isSpecialNumber?: boolean;
  isStarred?: boolean;
  is_starred?: boolean;
  starred?: boolean;
  revision?: number;
  createdAt?: string;
  created_at?: string;
  updatedAt: string;
  updated_at?: string;
  deletedAt?: string | null;
  deleted_at?: string | null;
}

export type LyricsMode = 'live' | 'snapshot' | 'custom';

export interface SetlistSongItem {
  id: string;
  songId?: string; // Reference to Song library if linked
  song_id?: string;
  title: string;
  keyNote?: string; // Optional legacy or key note
  key_note?: string;
  notes?: string; // Stanza notes, style, etc.
  lyricsMode?: LyricsMode;
  lyrics_mode?: LyricsMode;
  lyricsSnapshot?: string | null;
  lyrics_snapshot?: string | null;
  sourceSongRevision?: number | null;
  source_song_revision?: number | null;
  revision?: number;
}

export type SetlistType = 'sunday' | 'prayer_meeting' | 'fellowship' | 'event';

export interface Setlist {
  id: string;
  type?: SetlistType; // 'sunday' | 'prayer_meeting' | 'fellowship' | 'event'
  title?: string; // Custom title
  date: string; // YYYY-MM-DD
  service_date?: string;
  presider?: string;
  welcomeSong?: string;
  welcome_song?: string;
  closingSong?: string;
  closing_song?: string;
  themeSong?: string;
  theme_song?: string;
  sundaySchool?: {
    songLeader: string;
    songs: SetlistSongItem[];
    notes?: string;
  };
  worshipService?: {
    songLeader: string;
    songs: SetlistSongItem[];
    notes?: string;
  };
  program?: {
    songLeader: string;
    songs: SetlistSongItem[];
    notes?: string;
  };
  generalNotes?: string;
  general_notes?: string;
  revision?: number;
  createdAt?: string;
  created_at?: string;
  updatedAt: string;
  updated_at?: string;
  deletedAt?: string | null;
  deleted_at?: string | null;
}

export interface BirthdayCelebrant {
  id: string;
  name: string;
  birthDate: string; // YYYY-MM-DD
  birth_date?: string;
  ministryOrGroup?: string;
  ministry_or_group?: string;
  notes?: string;
  revision?: number;
}

export type AnniversaryType = 'Wedding' | 'Church' | 'Ministry' | 'Other';

export interface AnniversaryCelebrant {
  id: string;
  title: string;
  anniversaryDate: string; // YYYY-MM-DD
  anniversary_date?: string;
  type: AnniversaryType;
  yearsCount?: number;
  years_count?: number;
  notes?: string;
  revision?: number;
}

export type VisitorTier = '1st timer' | '2nd timer' | '3rd timer' | 'Regular attender';

export interface Visitor {
  id: string;
  name: string;
  barangay: string;
  tier: VisitorTier;
  dateVisited: string; // YYYY-MM-DD
  date_visited?: string;
  contactNumber?: string;
  contact_number?: string;
  notes?: string;
  revision?: number;
}

export type SpecialRecognitionType =
  | 'Newly Graduated'
  | 'Board Passer'
  | 'Newlywed'
  | 'Newly Baptized'
  | 'Baby Dedication'
  | 'Custom';

export interface SpecialRecognition {
  id: string;
  name: string;
  recognitionType: SpecialRecognitionType;
  recognition_type?: SpecialRecognitionType;
  customType?: string;
  custom_type?: string;
  date: string; // YYYY-MM-DD
  recognition_date?: string;
  description?: string;
  revision?: number;
}

export interface SpecialNumberEntry {
  id: string;
  performerName: string;
  performer_name?: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduled_date?: string;
  songTitle?: string;
  song_title?: string;
  songId?: string;
  song_id?: string;
  lyricsMode?: LyricsMode;
  lyrics_mode?: LyricsMode;
  lyricsSnapshot?: string | null;
  lyrics_snapshot?: string | null;
  sourceSongRevision?: number | null;
  source_song_revision?: number | null;
  minusOneLink?: string;
  minus_one_link?: string;
  notes?: string;
  lyrics?: string;
  status?: 'scheduled' | 'practicing' | 'ready' | 'completed' | 'cancelled';
  revision?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface ChoirEntry {
  id: string;
  date: string; // YYYY-MM-DD presentation/service date
  service_date?: string;
  songTitle: string;
  song_title?: string;
  artist?: string;
  songId?: string;
  song_id?: string;
  lyricsMode?: LyricsMode;
  lyrics_mode?: LyricsMode;
  lyricsSnapshot?: string | null;
  lyrics_snapshot?: string | null;
  sourceSongRevision?: number | null;
  source_song_revision?: number | null;
  lyrics?: string;
  notes?: string;
  choirGroup?: string;
  choir_group?: string;
  isDone?: boolean;
  is_done?: boolean;
  revision?: number;
  createdAt: string;
  updatedAt?: string;
}

export type AppTab = 'home' | 'recognitions' | 'special-numbers' | 'songs' | 'settings';
export type RecognitionsSubTab = 'birthdays' | 'anniversaries' | 'visitors' | 'special';
export type SpecialNumbersSubTab = 'schedules' | 'practice' | 'choir';

export type VocalPartLabel =
  | 'Soprano'
  | 'Alto'
  | 'Tenor'
  | 'Bass'
  | 'Baritone'
  | 'Lead'
  | 'Harmony'
  | 'Choir / All'
  | 'Custom';

export interface PracticePartTrack {
  id: string;
  partLabel: VocalPartLabel;
  customLabel?: string;
  custom_label?: string;
  assignedUsers?: string[];
  assignedTo?: string;
  name?: string;
  type?: 'link' | 'audio' | 'video' | 'file';
  urlOrData?: string;
  audioUrl?: string;
  notes?: string;
  position?: number;
  revision?: number;
  createdAt?: string;
}

export interface PracticeGroupEntry {
  id: string;
  type?: string;
  groupName: string;
  group_name?: string;
  targetDate?: string;
  target_date?: string;
  practiceDate?: string;
  practice_date?: string;
  practiceTime?: string;
  practice_time?: string;
  assignedEvent?: string;
  assigned_event?: string;
  songTitle: string;
  song_title?: string;
  artist?: string;
  lyrics: string;
  songId?: string;
  song_id?: string;
  lyricsMode?: LyricsMode;
  lyrics_mode?: LyricsMode;
  lyricsSnapshot?: string | null;
  lyrics_snapshot?: string | null;
  sourceSongRevision?: number | null;
  source_song_revision?: number | null;
  notes?: string;
  attachments?: SongAttachment[];
  customAttachments?: SongAttachment[];
  parts?: PracticePartTrack[];
  vocalParts?: PracticePartTrack[];
  isDone?: boolean;
  is_done?: boolean;
  revision?: number;
  createdAt: string;
  updatedAt?: string;
}

export type SupabaseConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error' | 'online' | 'offline' | 'quota-exceeded';

export interface TableSyncStatus {
  table?: string;
  name?: string;
  displayName?: string;
  itemCount?: number;
  lastEventTime?: number | null;
  lastSyncTime?: number | null;
  lastSyncTimestamp?: number | null;
  status: 'synced' | 'syncing' | 'error' | 'connected' | string;
  error?: string | null;
}

export interface DatabaseStatusInfo {
  status: SupabaseConnectionStatus;
  provider: 'supabase' | 'firestore';
  projectUrl?: string;
  databaseUrl?: string;
  tableLogs?: Record<string, TableSyncStatus>;
  collectionLogs?: Record<string, any>;
  lastSyncTime?: number | null;
  errorMessage?: string;
  quotaResetMessage?: string;
}
