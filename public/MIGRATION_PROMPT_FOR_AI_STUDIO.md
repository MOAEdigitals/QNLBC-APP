# CHURCH MUSIC & MINISTRY MANAGEMENT PLATFORM
## Complete Specification & Migration Prompt for Gemini / Codex / AI Studio

> **Use this document**: Copy and paste the entire prompt below directly into **Google AI Studio** or **Gemini / Codex** when creating a new app/repository. It contains the exact functional requirements, architecture rules, database schemas, and migration steps to produce a completely clean, robust codebase without legacy bugs.

---

```markdown
# TASK: Build a Modern Church Music & Ministry Management Web Application

Build a production-ready, mobile-friendly Church Music & Worship Ministry Management Progressive Web App (PWA) with React 18, TypeScript, Tailwind CSS, and Lucide icons.

---

### 1. CORE PURPOSE & PROBLEM TO SOLVE
The app serves a local church (New Life Baptist Church / QNLBC) to coordinate weekly Sunday Worship services, songs, choir, musicians, and member announcements.
Key issues from past builds to **avoid**:
1. **Never exhaust database write quotas**: 
   - Store static song libraries efficiently (e.g. initial bundled catalog of 652 songs).
   - Only write to the cloud when a user actually creates, updates, or deletes an item. Do not batch-rewrite hundreds of unchanged records on startup or status check.
2. **Deterministic Multi-Device Sync**:
   - Clean, lightweight Firestore or server REST synchronization.
   - Offline-capable with local cache fallback so the app functions smoothly even with spotty church sanctuary Wi-Fi or mobile data.
3. **Role-Based Authentication**:
   - Dedicated Administrator role (`admin`) for full management, editing setlists, deleting songs, importing/exporting data, and managing member accounts.
   - User role (`user`) for ministry members (musicians, singers, song leaders) to view setlists, practice songs, view minus-ones/lyrics, and manage their assigned parts without destructive administrative access.

---

### 2. CORE MODULES & NAVIGATION

The app features a bottom navigation bar on mobile (and clean header/sidebar on desktop):

1. **Setlists (Home / Schedule)**:
   - Types: Sunday Worship, Midweek Prayer Meeting, Youth/Fellowship, Special Events.
   - Structure for Sunday Service:
     * Date (YYYY-MM-DD)
     * Presider
     * Welcome Song, Closing Song, Theme Song
     * Sunday School: Song Leader, 2–3 Songs (linked to Song Library or custom title)
     * Worship Service: Song Leader, 2–4 Songs (linked to Song Library with minus-one links, attachments, lyrics preview)
     * General notes / announcements
   - Presentation / Stage Mode: Quick full-screen view for musicians/presiders during live services.

2. **Song Library (Catalog)**:
   - Full-text search by title, lyrics, and artist.
   - Filter chips: Hymns, Praise & Worship, Tagalog, Choir, Special Numbers, Starred/Favorites.
   - Song details: Complete lyrics, artist, key/chords note, minus-one audio/video YouTube links, uploaded sheet music or chord attachments.
   - Quick "Add to Upcoming Setlist" action directly from any song card.

3. **Special Numbers & Choir**:
   - Special Numbers: Scheduled presentation calendar (date, performer name, song title, minus-one link, status).
   - Choir: Rehearsal schedule, pieces for upcoming services, audio practice references.

4. **Celebrants & Fellowship (Announcements)**:
   - Birthdays & Anniversaries: Automatic grouping by "This Week", "This Month", and upcoming dates with celebratory badges.
   - Visitors Tracker: 1st time, 2nd time, 3rd time, regular attender.
   - Special Recognitions: Graduations, board passers, dedications.

5. **Practice / Musicians Room**:
   - Rehearsal tracker, setlist song run-through order, metronome/tempo helper, and quick links to minus-one backing tracks.

6. **Settings & Data Management**:
   - User management (Add member, reset password, change roles: admin vs user).
   - Backup & Restore: One-click JSON database export and JSON import for instant device-to-device migration.
   - Cloud Sync status indicator.
   - Dark / Light mode toggle.

---

### 3. DATA MODELS (TypeScript Interfaces)

```typescript
export type UserRole = 'admin' | 'user';

export interface UserAccount {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  avatar?: string;
  createdAt: string;
}

export interface SongAttachment {
  id: string;
  name: string;
  category?: 'plus_one' | 'minus_one';
  type: 'link' | 'audio' | 'video' | 'image' | 'text' | 'file';
  urlOrData?: string;
  uploadedAt?: string;
}

export interface Song {
  id: string;
  title: string;
  artist?: string;
  category?: string; // 'Hymn' | 'Praise & Worship' | 'Choir' | 'Tagalog' | etc.
  lyrics: string;
  minusOneLink?: string;
  attachments?: SongAttachment[];
  isStarred?: boolean;
  updatedAt: string;
}

export interface SetlistSongItem {
  id: string;
  songId?: string;
  title: string;
  notes?: string;
}

export interface Setlist {
  id: string;
  type: 'sunday' | 'prayer_meeting' | 'fellowship' | 'event';
  title?: string;
  date: string; // YYYY-MM-DD
  presider?: string;
  welcomeSong?: string;
  closingSong?: string;
  themeSong?: string;
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
  generalNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpecialNumberEntry {
  id: string;
  performerName: string;
  scheduledDate: string; // YYYY-MM-DD
  songTitle?: string;
  minusOneLink?: string;
  notes?: string;
  createdAt: string;
}

export interface BirthdayCelebrant {
  id: string;
  name: string;
  birthDate: string; // YYYY-MM-DD
  ministryOrGroup?: string;
}
```

---

### 4. DEFAULT SEED ACCOUNTS & DATA
- **Admin**:
  - Username: `QNLBC` (or `admin`)
  - Password: `qnlbc2026`
- **Team Members (User Role)**:
  - `ERIC` (`m@rkeric`), `JOSHUA` (`m@rkjoshua`), `JONAH` (`jon@bhi`), `RONNIE` (`ronni3P`), `JOY` (`alici@joy`), `DM` (`dennism@tthew`), `ALJOE` (`aljo3pogi`), `ROGER` (`qnlbcroger`), `MARY ROSE` (`maryros3`), `JV` (`johnvinc3nt`), `LUZ` (`luzvimind@`)

---

### 5. ARCHITECTURE & PERSISTENCE STRATEGY (CRUCIAL)
1. **Local-First with Cloud Hydration**:
   - App loads instantly using local storage / IndexedDB cache so there is zero initial delay or white screen.
   - Background sync listens for changes without firing endless batch re-writes.
2. **Quota Protection**:
   - Song catalog: Bundle the comprehensive hymn/praise catalog as a local static JSON asset. Only save custom-added/edited songs to Firestore.
   - Setlists & Announcements: Sync directly to Firestore collections (`setlists`, `special_numbers`, `users`, `celebrants`).
3. **Backup / Migration Route**:
   - Provide a clean JSON backup upload/download under Settings that can hydrate the database in under 2 seconds.
```
