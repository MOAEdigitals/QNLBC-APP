export type UserRole = 'admin' | 'user';

export interface UserAccount {
  id: string;
  username: string;
  passwordHash: string; // Plain/stored for internal church auth
  role: UserRole;
  avatar?: string; // Base64 compressed image data URL for profile picture
  createdAt: string;
}

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
  lyrics: string;
  minusOneLink?: string;
  attachments?: SongAttachment[];
  isWelcomeSong?: boolean;
  isClosingSong?: boolean;
  isSpecialNumber?: boolean;
  updatedAt: string;
}

export interface SetlistSongItem {
  id: string;
  songId?: string; // Reference to Song library if linked
  title: string;
  keyNote?: string; // Optional legacy or key note
  notes?: string; // Stanza notes, style, etc. (empty by default)
}

export type SetlistType = 'sunday' | 'prayer_meeting' | 'fellowship' | 'event';

export interface Setlist {
  id: string;
  type?: SetlistType; // 'sunday' | 'prayer_meeting' | 'fellowship' | 'event'
  title?: string; // Custom title for Fellowship (e.g. "Youth Fellowship") or Event (e.g. "Mission Conference")
  date: string; // YYYY-MM-DD
  presider?: string; // Optional for prayer meeting
  welcomeSong?: string; // Welcome song (e.g. "Napakaligaya")
  closingSong?: string; // Closing song (e.g. "Give Thanks")
  themeSong?: string; // Month theme song
  sundaySchool?: {
    songLeader: string;
    songs: SetlistSongItem[]; // 2-3 songs
    notes?: string;
  };
  worshipService?: {
    songLeader: string;
    songs: SetlistSongItem[]; // 2-4 songs
    notes?: string;
  };
  program?: {
    songLeader: string;
    songs: SetlistSongItem[]; // 1-2 for prayer meeting, 2-3 for fellowship, 3-4 for event
    notes?: string;
  };
  generalNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BirthdayCelebrant {
  id: string;
  name: string;
  birthDate: string; // YYYY-MM-DD
  ministryOrGroup?: string;
  notes?: string;
}

export type AnniversaryType = 'Wedding' | 'Church' | 'Ministry' | 'Other';

export interface AnniversaryCelebrant {
  id: string;
  title: string; // e.g. "Bro. Mark & Sis. Grace" or "Youth Ministry"
  anniversaryDate: string; // YYYY-MM-DD
  type: AnniversaryType;
  yearsCount?: number;
  notes?: string;
}

export type VisitorTier = '1st timer' | '2nd timer' | '3rd timer' | 'Regular attender';

export interface Visitor {
  id: string;
  name: string;
  barangay: string; // Place of origin
  tier: VisitorTier;
  dateVisited: string; // YYYY-MM-DD
  contactNumber?: string;
  notes?: string;
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
  customType?: string;
  date: string; // YYYY-MM-DD
  description?: string;
}

export interface SpecialNumberEntry {
  id: string;
  performerName: string;
  scheduledDate: string; // YYYY-MM-DD
  songTitle?: string; // Can be left empty if song is not yet decided
  songId?: string;
  minusOneLink?: string;
  notes?: string;
  lyrics?: string;
  createdAt: string;
}

export type AppTab = 'home' | 'recognitions' | 'special-numbers' | 'songs' | 'settings';
export type RecognitionsSubTab = 'birthdays' | 'anniversaries' | 'visitors' | 'special';
export type SpecialNumbersSubTab = 'schedules' | 'practice';

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
  assignedUsers?: string[];
  assignedTo?: string; // e.g. "Sis. Grace", "Bro. John"
  name?: string; // Track name e.g. "Alto Practice Vocal"
  type?: 'link' | 'audio' | 'video' | 'file';
  urlOrData?: string;
  audioUrl?: string;
  notes?: string;
  createdAt?: string;
}

export interface PracticeGroupEntry {
  id: string;
  groupName: string; // e.g. "Youth Choir", "Men's Quartet", "Praise Team Ensemble", "Sisters Trio"
  targetDate?: string; // Optional upcoming presentation date
  practiceDate?: string;
  practiceTime?: string;
  assignedEvent?: string;
  songTitle: string;
  artist?: string;
  lyrics: string;
  songId?: string; // reference to original song in songs library if linked
  notes?: string;
  attachments?: SongAttachment[]; // isolated practice plus_one / minus_one attachments
  customAttachments?: SongAttachment[];
  parts?: PracticePartTrack[]; // vocal parts tracks (Tenor, Alto, Soprano, Bass, Baritone, etc.)
  vocalParts?: PracticePartTrack[];
  createdAt: string;
  updatedAt?: string;
}

