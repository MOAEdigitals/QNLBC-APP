export type UserRole = 'admin' | 'user';

export interface UserAccount {
  id: string;
  username: string;
  passwordHash: string; // Plain/stored for internal church auth
  role: UserRole;
  createdAt: string;
}

export interface SongAttachment {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'link' | 'text';
  urlOrData: string;
  createdAt: string;
}

export interface Song {
  id: string;
  title: string;
  artist?: string;
  lyrics: string;
  minusOneLink?: string;
  attachments?: SongAttachment[];
  updatedAt: string;
}

export interface SetlistSongItem {
  id: string;
  songId?: string; // Reference to Song library if linked
  title: string;
  keyNote?: string;
  notes?: string;
}

export interface Setlist {
  id: string;
  date: string; // YYYY-MM-DD
  presider: string;
  sundaySchool: {
    songLeader: string;
    songs: SetlistSongItem[]; // 2-4 songs
    notes?: string;
  };
  worshipService: {
    songLeader: string;
    songs: SetlistSongItem[]; // 2-4 songs
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
  songTitle: string;
  songId?: string;
  minusOneLink?: string;
  notes?: string;
  lyrics: string;
  createdAt: string;
}

export type AppTab = 'home' | 'recognitions' | 'special-numbers' | 'songs' | 'settings';
export type RecognitionsSubTab = 'birthdays' | 'anniversaries' | 'visitors' | 'special';
