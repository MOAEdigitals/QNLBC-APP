import { supabase, isSupabaseConfigured } from '../supabase';
import {
  Song,
  Setlist,
  SetlistSongItem,
  SpecialNumberEntry,
  ChoirEntry,
  PracticeGroupEntry,
  PracticePartTrack,
  SongAttachment,
  BirthdayCelebrant,
  AnniversaryCelebrant,
  Visitor,
  SpecialRecognition,
  UserAccount,
  DatabaseStatusInfo,
  TableSyncStatus,
  LyricsMode,
} from '../types';

export class ConcurrencyConflictError extends Error {
  constructor(message = 'Conflict: The record has been modified by another user. Your draft has been preserved.') {
    super(message);
    this.name = 'ConcurrencyConflictError';
  }
}

// Helper to check for standard valid UUID
export function isUUID(str?: string | null): boolean {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
}

// Helper to generate standard UUID v4
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// -------------------------------------------------------------
// Linked Lyrics Resolution (Requirement 15)
// Live lyrics resolve from songs through song_id
// Snapshot/custom lyrics use lyrics_snapshot
// Never overwrite catalog lyrics from schedule edits
// Never match or merge songs only by title
// -------------------------------------------------------------
export function resolveItemLyrics(
  item: {
    songId?: string | null;
    lyricsMode?: LyricsMode;
    lyricsSnapshot?: string | null;
    lyrics?: string;
  },
  songsCatalog: Song[] | Map<string, Song>
): string {
  const mode = item.lyricsMode || 'live';
  if (mode === 'live' && item.songId) {
    let song: Song | undefined;
    if (songsCatalog instanceof Map) {
      song = songsCatalog.get(item.songId);
    } else {
      song = songsCatalog.find((s) => s.id === item.songId);
    }
    if (song) {
      return song.lyrics || '';
    }
  }
  return item.lyricsSnapshot || item.lyrics || '';
}

// -------------------------------------------------------------
// PROFILES & AUTHENTICATION
// -------------------------------------------------------------
export async function fetchCurrentUserProfile(userId: string): Promise<UserAccount | null> {
  if (!isSupabaseConfigured() || !userId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) {
    console.warn('Failed to load profile for user', userId, error);
    return null;
  }

  return {
    id: data.id,
    username: data.username,
    displayName: data.display_name || data.username,
    display_name: data.display_name || data.username,
    role: data.role as 'admin' | 'user',
    active: Boolean(data.active),
    permissions: {
      canAdd: data.role === 'admin' || Boolean(data.can_add),
      canEdit: data.role === 'admin' || Boolean(data.can_edit),
      canDelete: data.role === 'admin' || Boolean(data.can_delete),
      canUpload: data.role === 'admin' || data.can_upload !== false,
    },
    avatar: data.avatar_url || undefined,
    avatarUrl: data.avatar_url || undefined,
    avatar_url: data.avatar_url || null,
    revision: Number(data.revision) || 1,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function fetchAllProfiles(): Promise<UserAccount[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true });

  if (error || !data) {
    console.warn('Failed to load profiles list:', error);
    return [];
  }

  return data.map((d) => ({
    id: d.id,
    username: d.username,
    displayName: d.display_name || d.username,
    display_name: d.display_name || d.username,
    role: d.role as 'admin' | 'user',
    active: Boolean(d.active),
    permissions: {
      canAdd: d.role === 'admin' || Boolean(d.can_add),
      canEdit: d.role === 'admin' || Boolean(d.can_edit),
      canDelete: d.role === 'admin' || Boolean(d.can_delete),
      canUpload: d.role === 'admin' || d.can_upload !== false,
    },
    avatar: d.avatar_url || undefined,
    avatarUrl: d.avatar_url || undefined,
    avatar_url: d.avatar_url || null,
    revision: Number(d.revision) || 1,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  }));
}

export async function updateUserProfile(
  targetUserId: string,
  updates: {
    displayName?: string;
    display_name?: string;
    avatarUrl?: string | null;
    avatar_url?: string | null;
    avatar?: string | null;
    role?: 'admin' | 'user';
    active?: boolean;
    canAdd?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
    canUpload?: boolean;
  },
  expectedRevision?: number
): Promise<UserAccount> {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured');

  const payload: Record<string, any> = {};
  if (updates.displayName !== undefined) payload.display_name = updates.displayName;
  if (updates.display_name !== undefined) payload.display_name = updates.display_name;
  if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;
  if (updates.avatar_url !== undefined) payload.avatar_url = updates.avatar_url;
  if (updates.avatar !== undefined) payload.avatar_url = updates.avatar;
  if (updates.role !== undefined) payload.role = updates.role;
  if (updates.active !== undefined) payload.active = updates.active;
  if (updates.canAdd !== undefined) payload.can_add = updates.canAdd;
  if (updates.canEdit !== undefined) payload.can_edit = updates.canEdit;
  if (updates.canDelete !== undefined) payload.can_delete = updates.canDelete;
  if (updates.canUpload !== undefined) payload.can_upload = updates.canUpload;

  let query = supabase
    .from('profiles')
    .update(payload)
    .eq('id', targetUserId);

  if (typeof expectedRevision === 'number') {
    query = query.eq('revision', expectedRevision);
  }

  const { data, error } = await query.select().single();

  if (error || !data) {
    throw new ConcurrencyConflictError(
      error?.message || 'Profile update conflict: user has been modified by another administrator.'
    );
  }

  return {
    id: data.id,
    username: data.username,
    displayName: data.display_name || data.username,
    display_name: data.display_name || data.username,
    role: data.role as 'admin' | 'user',
    active: Boolean(data.active),
    permissions: {
      canAdd: data.role === 'admin' || Boolean(data.can_add),
      canEdit: data.role === 'admin' || Boolean(data.can_edit),
      canDelete: data.role === 'admin' || Boolean(data.can_delete),
      canUpload: data.role === 'admin' || data.can_upload !== false,
    },
    avatar: data.avatar_url || undefined,
    avatarUrl: data.avatar_url || undefined,
    avatar_url: data.avatar_url || null,
    revision: Number(data.revision) || 1,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function setProfileRole(userId: string, role: 'admin' | 'user'): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
  if (error) {
    throw new Error(error.message);
  }
}

export async function toggleProfileActive(userId: string, active: boolean): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase.from('profiles').update({ active }).eq('id', userId);
  if (error) {
    throw new Error(error.message);
  }
}

export async function setProfilePermissions(
  userId: string,
  permissions: { canAdd: boolean; canEdit: boolean; canDelete: boolean; canUpload: boolean }
): Promise<UserAccount> {
  return updateUserProfile(userId, permissions);
}

// -------------------------------------------------------------
// GENERIC RPC SOFT DELETE & RESTORE
// -------------------------------------------------------------
export async function executeSoftDelete(
  targetTable: string,
  targetId: string,
  expectedRevision: number
): Promise<number> {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured');

  const { data, error } = await supabase.rpc('soft_delete_record', {
    target_table: targetTable,
    target_id: targetId,
    expected_revision: expectedRevision,
  });

  if (error) {
    throw new ConcurrencyConflictError(
      error.message || `Failed to delete record in ${targetTable}: revision conflict or already removed.`
    );
  }

  return Number(data);
}

export async function executeRestore(
  targetTable: string,
  targetId: string,
  expectedRevision: number
): Promise<number> {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured');

  const { data, error } = await supabase.rpc('restore_record', {
    target_table: targetTable,
    target_id: targetId,
    expected_revision: expectedRevision,
  });

  if (error) {
    throw new ConcurrencyConflictError(
      error.message || `Failed to restore record in ${targetTable}: revision conflict.`
    );
  }

  return Number(data);
}

// -------------------------------------------------------------
// SONGS DATA ACCESS
// -------------------------------------------------------------
export function mapSongFromDB(row: any): Song {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist || undefined,
    lyrics: row.lyrics || '',
    category: row.category || undefined,
    categories: Array.isArray(row.categories) ? row.categories : [],
    minusOneLink: row.minus_one_link || undefined,
    minus_one_link: row.minus_one_link || undefined,
    isStarred: Boolean(row.is_starred),
    is_starred: Boolean(row.is_starred),
    starred: Boolean(row.is_starred),
    isWelcomeSong: Boolean(row.is_welcome_song),
    is_welcome_song: Boolean(row.is_welcome_song),
    isClosingSong: Boolean(row.is_closing_song),
    is_closing_song: Boolean(row.is_closing_song),
    isThemeSong: Boolean(row.is_theme_song),
    is_theme_song: Boolean(row.is_theme_song),
    revision: Number(row.revision) || 1,
    createdAt: row.created_at,
    created_at: row.created_at,
    updatedAt: row.updated_at || new Date().toISOString(),
    updated_at: row.updated_at,
    deletedAt: row.deleted_at || null,
    deleted_at: row.deleted_at || null,
  };
}

export async function fetchSongs(): Promise<Song[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .is('deleted_at', null)
    .order('title', { ascending: true });

  if (error) {
    console.error('Error fetching songs from Supabase:', error);
    throw error;
  }

  return (data || []).map(mapSongFromDB);
}

export async function saveSong(song: Partial<Song>, isNew = false): Promise<Song> {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured');

  const payload = {
    title: song.title?.trim() || 'Untitled Song',
    artist: song.artist?.trim() || null,
    lyrics: song.lyrics || '',
    category: song.category?.trim() || null,
    categories: song.categories || [],
    minus_one_link: (song.minusOneLink || song.minus_one_link)?.trim() || null,
    is_starred: Boolean(song.isStarred ?? song.is_starred ?? song.starred),
    is_welcome_song: Boolean(song.isWelcomeSong ?? song.is_welcome_song),
    is_closing_song: Boolean(song.isClosingSong ?? song.is_closing_song),
    is_theme_song: Boolean(song.isThemeSong ?? song.is_theme_song),
    metadata: {},
  };

  const hasValidUUID = isUUID(song.id);

  if (isNew || !hasValidUUID) {
    const { data, error } = await supabase
      .from('songs')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) throw error || new Error('Failed to create song');
    return mapSongFromDB(data);
  }

  const expectedRev = song.revision || 1;
  const { data, error } = await supabase
    .from('songs')
    .update(payload)
    .eq('id', song.id)
    .eq('revision', expectedRev)
    .select('*')
    .single();

  if (error || !data) {
    throw new ConcurrencyConflictError(
      error?.message || 'Song update conflict: the song has been updated by another user.'
    );
  }

  return mapSongFromDB(data);
}

export async function deleteSong(songId: string, expectedRevision: number): Promise<void> {
  await executeSoftDelete('songs', songId, expectedRevision);
}

// -------------------------------------------------------------
// SETLISTS & SETLIST ITEMS DATA ACCESS
// -------------------------------------------------------------
export async function fetchSetlists(): Promise<Setlist[]> {
  if (!isSupabaseConfigured()) return [];

  // Query setlists and active setlist_items
  const { data: setlistsData, error: setlistErr } = await supabase
    .from('setlists')
    .select('*')
    .is('deleted_at', null)
    .order('service_date', { ascending: false });

  if (setlistErr) throw setlistErr;
  if (!setlistsData || setlistsData.length === 0) return [];

  const setlistIds = setlistsData.map((s) => s.id);
  const { data: itemsData, error: itemsErr } = await supabase
    .from('setlist_items')
    .select('*')
    .in('setlist_id', setlistIds)
    .is('deleted_at', null)
    .order('position', { ascending: true });

  if (itemsErr) throw itemsErr;

  const itemsBySetlistId = new Map<string, any[]>();
  for (const item of itemsData || []) {
    const list = itemsBySetlistId.get(item.setlist_id) || [];
    list.push(item);
    itemsBySetlistId.set(item.setlist_id, list);
  }

  return setlistsData.map((row) => {
    const items = itemsBySetlistId.get(row.id) || [];

    const mapItems = (section: string): SetlistSongItem[] =>
      items
        .filter((i) => i.section === section)
        .sort((a, b) => a.position - b.position)
        .map((i) => ({
          id: i.id,
          songId: i.song_id || undefined,
          song_id: i.song_id || undefined,
          title: i.song_title,
          keyNote: i.key_note || undefined,
          key_note: i.key_note || undefined,
          notes: i.notes || undefined,
          lyricsMode: i.lyrics_mode as LyricsMode,
          lyrics_mode: i.lyrics_mode as LyricsMode,
          lyricsSnapshot: i.lyrics_snapshot || null,
          lyrics_snapshot: i.lyrics_snapshot || null,
          sourceSongRevision: i.source_song_revision ? Number(i.source_song_revision) : null,
          source_song_revision: i.source_song_revision ? Number(i.source_song_revision) : null,
          revision: Number(i.revision) || 1,
        }));

    return {
      id: row.id,
      type: row.type,
      title: row.title || undefined,
      date: row.service_date,
      service_date: row.service_date,
      presider: row.presider || undefined,
      welcomeSong: row.welcome_song || undefined,
      welcome_song: row.welcome_song || undefined,
      closingSong: row.closing_song || undefined,
      closing_song: row.closing_song || undefined,
      themeSong: row.theme_song || undefined,
      theme_song: row.theme_song || undefined,
      sundaySchool: {
        songLeader: row.sunday_school_leader || '',
        songs: mapItems('sunday_school'),
        notes: row.sunday_school_notes || undefined,
      },
      worshipService: {
        songLeader: row.worship_leader || '',
        songs: mapItems('worship'),
        notes: row.worship_notes || undefined,
      },
      program: {
        songLeader: row.program_leader || '',
        songs: mapItems('program'),
        notes: row.program_notes || undefined,
      },
      generalNotes: row.general_notes || undefined,
      general_notes: row.general_notes || undefined,
      revision: Number(row.revision) || 1,
      createdAt: row.created_at,
      created_at: row.created_at,
      updatedAt: row.updated_at || new Date().toISOString(),
      updated_at: row.updated_at,
      deletedAt: row.deleted_at || null,
      deleted_at: row.deleted_at || null,
    };
  });
}

export async function saveSetlist(setlist: Partial<Setlist>, isNew = false): Promise<Setlist> {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured');

  const setlistPayload = {
    type: setlist.type || 'sunday',
    title: setlist.title?.trim() || null,
    service_date: setlist.date || setlist.service_date || new Date().toISOString().slice(0, 10),
    presider: setlist.presider?.trim() || null,
    welcome_song: (setlist.welcomeSong || setlist.welcome_song)?.trim() || null,
    closing_song: (setlist.closingSong || setlist.closing_song)?.trim() || null,
    theme_song: (setlist.themeSong || setlist.theme_song)?.trim() || null,
    sunday_school_leader: setlist.sundaySchool?.songLeader?.trim() || null,
    sunday_school_notes: setlist.sundaySchool?.notes?.trim() || null,
    worship_leader: setlist.worshipService?.songLeader?.trim() || null,
    worship_notes: setlist.worshipService?.notes?.trim() || null,
    program_leader: setlist.program?.songLeader?.trim() || null,
    program_notes: setlist.program?.notes?.trim() || null,
    general_notes: (setlist.generalNotes || setlist.general_notes)?.trim() || null,
  };

  let savedRow: any;
  let targetSetlistId: string;
  const hasValidUUID = isUUID(setlist.id);

  if (isNew || !hasValidUUID) {
    const { data, error } = await supabase
      .from('setlists')
      .insert(setlistPayload)
      .select('*')
      .single();

    if (error || !data) throw error || new Error('Failed to create setlist');
    savedRow = data;
    targetSetlistId = data.id;
  } else {
    targetSetlistId = setlist.id!;
    const expectedRev = setlist.revision || 1;
    const { data, error } = await supabase
      .from('setlists')
      .update(setlistPayload)
      .eq('id', targetSetlistId)
      .eq('revision', expectedRev)
      .select('*')
      .single();

    if (error || !data) {
      throw new ConcurrencyConflictError(
        error?.message || 'Setlist update conflict: this setlist was modified by another user.'
      );
    }
    savedRow = data;
  }

  // Manage setlist_items for the 3 sections:
  const sectionsToSync: Array<{ section: string; items: SetlistSongItem[] }> = [
    { section: 'sunday_school', items: setlist.sundaySchool?.songs || [] },
    { section: 'worship', items: setlist.worshipService?.songs || [] },
    { section: 'program', items: setlist.program?.songs || [] },
  ];

  for (const { section, items } of sectionsToSync) {
    // Delete existing active items in this section if rewriting
    // To preserve revisions cleanly, delete obsolete items
    const { data: existingItems } = await supabase
      .from('setlist_items')
      .select('id, revision')
      .eq('setlist_id', targetSetlistId)
      .eq('section', section)
      .is('deleted_at', null);

    const keptIds = new Set<string>();

    for (let pos = 0; pos < items.length; pos++) {
      const item = items[pos];
      const hasItemUUID = isUUID(item.id);
      const rawSongId = (item.songId || item.song_id)?.trim();
      const validSongId = isUUID(rawSongId) ? rawSongId : null;

      const itemPayload = {
        setlist_id: targetSetlistId,
        section,
        position: pos,
        song_id: validSongId,
        song_title: item.title?.trim() || 'Untitled',
        key_note: (item.keyNote || item.key_note)?.trim() || null,
        notes: item.notes?.trim() || null,
        lyrics_mode: item.lyricsMode || item.lyrics_mode || 'live',
        lyrics_snapshot: item.lyricsSnapshot || item.lyrics_snapshot || null,
        source_song_revision: item.sourceSongRevision || item.source_song_revision || null,
      };

      const matchExisting = hasItemUUID ? existingItems?.find((e) => e.id === item.id) : null;
      if (matchExisting) {
        keptIds.add(matchExisting.id);
        await supabase
          .from('setlist_items')
          .update(itemPayload)
          .eq('id', matchExisting.id)
          .eq('revision', matchExisting.revision);
      } else {
        const { data: savedItem, error: itemErr } = await supabase
          .from('setlist_items')
          .insert(itemPayload)
          .select('*')
          .single();
        if (!itemErr && savedItem) {
          keptIds.add(savedItem.id);
        }
      }
    }

    // Soft-delete items that were removed
    for (const ex of existingItems || []) {
      if (!keptIds.has(ex.id)) {
        try {
          await executeSoftDelete('setlist_items', ex.id, Number(ex.revision));
        } catch {
          // ignore already deleted
        }
      }
    }
  }

  const all = await fetchSetlists();
  const refreshed = all.find((s) => s.id === targetSetlistId);
  return refreshed || (setlist as Setlist);
}

export async function deleteSetlist(setlistId: string, expectedRevision: number): Promise<void> {
  await executeSoftDelete('setlists', setlistId, expectedRevision);
}

// -------------------------------------------------------------
// SPECIAL NUMBERS DATA ACCESS
// -------------------------------------------------------------
export function mapSpecialNumberFromDB(row: any): SpecialNumberEntry {
  return {
    id: row.id,
    performerName: row.performer_name,
    performer_name: row.performer_name,
    scheduledDate: row.scheduled_date,
    scheduled_date: row.scheduled_date,
    songId: row.song_id || undefined,
    song_id: row.song_id || undefined,
    songTitle: row.song_title || undefined,
    song_title: row.song_title || undefined,
    lyricsMode: row.lyrics_mode as LyricsMode,
    lyrics_mode: row.lyrics_mode as LyricsMode,
    lyricsSnapshot: row.lyrics_snapshot || null,
    lyrics_snapshot: row.lyrics_snapshot || null,
    sourceSongRevision: row.source_song_revision ? Number(row.source_song_revision) : null,
    source_song_revision: row.source_song_revision ? Number(row.source_song_revision) : null,
    minusOneLink: row.minus_one_link || undefined,
    minus_one_link: row.minus_one_link || undefined,
    notes: row.notes || undefined,
    lyrics: row.lyrics_snapshot || undefined,
    status: row.status || 'scheduled',
    revision: Number(row.revision) || 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export async function fetchSpecialNumbers(): Promise<SpecialNumberEntry[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('special_numbers')
    .select('*')
    .is('deleted_at', null)
    .order('scheduled_date', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapSpecialNumberFromDB);
}

export async function saveSpecialNumber(
  entry: Partial<SpecialNumberEntry>,
  isNew = false
): Promise<SpecialNumberEntry> {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured');

  const rawSongId = (entry.songId || entry.song_id)?.trim();
  const validSongId = isUUID(rawSongId) ? rawSongId : null;

  const payload = {
    performer_name: (entry.performerName || entry.performer_name)?.trim() || 'Performer',
    scheduled_date: entry.scheduledDate || entry.scheduled_date || new Date().toISOString().slice(0, 10),
    song_id: validSongId,
    song_title: (entry.songTitle || entry.song_title)?.trim() || null,
    lyrics_mode: entry.lyricsMode || entry.lyrics_mode || 'live',
    lyrics_snapshot: entry.lyricsSnapshot || entry.lyrics_snapshot || entry.lyrics || null,
    source_song_revision: entry.sourceSongRevision || entry.source_song_revision || null,
    minus_one_link: (entry.minusOneLink || entry.minus_one_link)?.trim() || null,
    notes: entry.notes?.trim() || null,
    status: entry.status || 'scheduled',
  };

  const hasValidUUID = isUUID(entry.id);

  if (isNew || !hasValidUUID) {
    const { data, error } = await supabase
      .from('special_numbers')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) throw error || new Error('Failed to create special number');
    return mapSpecialNumberFromDB(data);
  }

  const expectedRev = entry.revision || 1;
  const { data, error } = await supabase
    .from('special_numbers')
    .update(payload)
    .eq('id', entry.id)
    .eq('revision', expectedRev)
    .select('*')
    .single();

  if (error || !data) {
    throw new ConcurrencyConflictError(
      error?.message || 'Special number update conflict: modified by another user.'
    );
  }

  return mapSpecialNumberFromDB(data);
}

export async function deleteSpecialNumber(id: string, expectedRevision: number): Promise<void> {
  await executeSoftDelete('special_numbers', id, expectedRevision);
}

// -------------------------------------------------------------
// CHOIR ENTRIES DATA ACCESS
// -------------------------------------------------------------
export function mapChoirEntryFromDB(row: any): ChoirEntry {
  return {
    id: row.id,
    date: row.service_date,
    service_date: row.service_date,
    choirGroup: row.choir_group,
    choir_group: row.choir_group,
    songId: row.song_id || undefined,
    song_id: row.song_id || undefined,
    songTitle: row.song_title,
    song_title: row.song_title,
    lyricsMode: row.lyrics_mode as LyricsMode,
    lyrics_mode: row.lyrics_mode as LyricsMode,
    lyricsSnapshot: row.lyrics_snapshot || null,
    lyrics_snapshot: row.lyrics_snapshot || null,
    sourceSongRevision: row.source_song_revision ? Number(row.source_song_revision) : null,
    source_song_revision: row.source_song_revision ? Number(row.source_song_revision) : null,
    lyrics: row.lyrics_snapshot || undefined,
    notes: row.notes || undefined,
    isDone: Boolean(row.is_done),
    is_done: Boolean(row.is_done),
    revision: Number(row.revision) || 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export async function fetchChoirEntries(): Promise<ChoirEntry[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('choir_entries')
    .select('*')
    .is('deleted_at', null)
    .order('service_date', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapChoirEntryFromDB);
}

export async function saveChoirEntry(entry: Partial<ChoirEntry>, isNew = false): Promise<ChoirEntry> {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured');

  const rawSongId = (entry.songId || entry.song_id)?.trim();
  const validSongId = isUUID(rawSongId) ? rawSongId : null;

  const payload = {
    choir_group: (entry.choirGroup || entry.choir_group)?.trim() || 'Church Choir',
    service_date: entry.date || entry.service_date || new Date().toISOString().slice(0, 10),
    song_id: validSongId,
    song_title: (entry.songTitle || entry.song_title)?.trim() || 'Untitled',
    lyrics_mode: entry.lyricsMode || entry.lyrics_mode || 'live',
    lyrics_snapshot: entry.lyricsSnapshot || entry.lyrics_snapshot || entry.lyrics || null,
    source_song_revision: entry.sourceSongRevision || entry.source_song_revision || null,
    notes: entry.notes?.trim() || null,
    is_done: Boolean(entry.isDone ?? entry.is_done),
  };

  const hasValidUUID = isUUID(entry.id);

  if (isNew || !hasValidUUID) {
    const { data, error } = await supabase
      .from('choir_entries')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) throw error || new Error('Failed to create choir entry');
    return mapChoirEntryFromDB(data);
  }

  const expectedRev = entry.revision || 1;
  const { data, error } = await supabase
    .from('choir_entries')
    .update(payload)
    .eq('id', entry.id)
    .eq('revision', expectedRev)
    .select('*')
    .single();

  if (error || !data) {
    throw new ConcurrencyConflictError(
      error?.message || 'Choir entry update conflict: modified by another user.'
    );
  }

  return mapChoirEntryFromDB(data);
}

export async function deleteChoirEntry(id: string, expectedRevision: number): Promise<void> {
  await executeSoftDelete('choir_entries', id, expectedRevision);
}

// -------------------------------------------------------------
// PRACTICE ENTRIES & VOCAL PARTS DATA ACCESS
// -------------------------------------------------------------
export function formatSupabaseError(error: any): string {
  if (!error) return 'Unknown database error';
  const parts: string[] = [];
  if (error.message) parts.push(`message: ${error.message}`);
  if (error.code) parts.push(`code: ${error.code}`);
  if (error.details) parts.push(`details: ${error.details}`);
  if (error.hint) parts.push(`hint: ${error.hint}`);
  return parts.length > 0 ? parts.join(' | ') : String(error);
}

function mapAttachmentFromDB(row: any): SongAttachment {
  return {
    id: row.id,
    name: row.name,
    category: row.category || undefined,
    type: row.kind,
    url: row.external_url || undefined,
    urlOrData: row.external_url || undefined,
    uploadedAt: row.created_at,
    createdAt: row.created_at,
    revision: Number(row.revision) || 1,
  };
}

function mapPracticeRowToEntry(
  row: any,
  parts: PracticePartTrack[] = [],
  attachments: SongAttachment[] = []
): PracticeGroupEntry {
  return {
    id: row.id,
    groupName: row.group_name,
    group_name: row.group_name,
    targetDate: row.target_date || undefined,
    target_date: row.target_date || undefined,
    practiceDate: row.practice_date || undefined,
    practice_date: row.practice_date || undefined,
    practiceTime: row.practice_time || undefined,
    practice_time: row.practice_time || undefined,
    assignedEvent: row.assigned_event || undefined,
    assigned_event: row.assigned_event || undefined,
    songId: row.song_id || undefined,
    song_id: row.song_id || undefined,
    songTitle: row.song_title,
    song_title: row.song_title,
    lyrics: row.lyrics_snapshot || '',
    lyricsMode: row.lyrics_mode as LyricsMode,
    lyrics_mode: row.lyrics_mode as LyricsMode,
    lyricsSnapshot: row.lyrics_snapshot || null,
    lyrics_snapshot: row.lyrics_snapshot || null,
    sourceSongRevision: row.source_song_revision ? Number(row.source_song_revision) : null,
    source_song_revision: row.source_song_revision ? Number(row.source_song_revision) : null,
    notes: row.notes || undefined,
    parts,
    vocalParts: parts,
    attachments,
    customAttachments: attachments,
    isDone: Boolean(row.is_done),
    is_done: Boolean(row.is_done),
    revision: Number(row.revision) || 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export async function fetchPracticeEntries(): Promise<PracticeGroupEntry[]> {
  if (!isSupabaseConfigured()) return [];

  const { data: practices, error: practiceErr } = await supabase
    .from('practice_entries')
    .select('*')
    .is('deleted_at', null)
    .order('practice_date', { ascending: false });

  if (practiceErr) {
    console.error('Error fetching practice entries from Supabase:', formatSupabaseError(practiceErr), practiceErr);
    throw practiceErr;
  }
  if (!practices || practices.length === 0) return [];

  const practiceIds = practices.map((p) => p.id);
  const { data: vocalParts, error: partsErr } = await supabase
    .from('vocal_parts')
    .select('*')
    .in('practice_id', practiceIds)
    .is('deleted_at', null)
    .order('position', { ascending: true });

  if (partsErr) {
    console.warn('Error fetching vocal parts for practice entries:', formatSupabaseError(partsErr));
  }

  const partIds = (vocalParts || []).map((part) => part.id);
  const [{ data: practiceAttachments, error: practiceAttachmentsErr }, { data: partAttachments, error: partAttachmentsErr }] =
    await Promise.all([
      supabase
        .from('attachments')
        .select('*')
        .eq('owner_type', 'practice')
        .in('owner_id', practiceIds)
        .is('deleted_at', null)
        .order('position', { ascending: true }),
      partIds.length > 0
        ? supabase
            .from('attachments')
            .select('*')
            .eq('owner_type', 'vocal_part')
            .in('owner_id', partIds)
            .is('deleted_at', null)
            .order('position', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (practiceAttachmentsErr) {
    console.warn('Error fetching practice attachments:', formatSupabaseError(practiceAttachmentsErr));
  }
  if (partAttachmentsErr) {
    console.warn('Error fetching vocal-part attachments:', formatSupabaseError(partAttachmentsErr));
  }

  const practiceAttachmentsByOwner = new Map<string, SongAttachment[]>();
  for (const attachment of practiceAttachments || []) {
    const list = practiceAttachmentsByOwner.get(attachment.owner_id) || [];
    list.push(mapAttachmentFromDB(attachment));
    practiceAttachmentsByOwner.set(attachment.owner_id, list);
  }

  const audioAttachmentByPart = new Map<string, any>();
  for (const attachment of partAttachments || []) {
    if (!audioAttachmentByPart.has(attachment.owner_id)) {
      audioAttachmentByPart.set(attachment.owner_id, attachment);
    }
  }

  const partsByPracticeId = new Map<string, PracticePartTrack[]>();
  for (const part of vocalParts || []) {
    const list = partsByPracticeId.get(part.practice_id) || [];
    const audioAttachment = audioAttachmentByPart.get(part.id);
    list.push({
      id: part.id,
      partLabel: part.label,
      customLabel: part.custom_label || undefined,
      custom_label: part.custom_label || undefined,
      name: part.name || undefined,
      notes: part.notes || undefined,
      type: audioAttachment?.kind || undefined,
      audioUrl: audioAttachment?.external_url || undefined,
      urlOrData: audioAttachment?.external_url || undefined,
      position: part.position,
      revision: Number(part.revision) || 1,
      createdAt: part.created_at,
    });
    partsByPracticeId.set(part.practice_id, list);
  }

  return practices.map((row) => {
    const parts = partsByPracticeId.get(row.id) || [];
    const attachments = practiceAttachmentsByOwner.get(row.id) || [];
    return mapPracticeRowToEntry(row, parts, attachments);
  });
}

function buildPracticePayload(entry: Partial<PracticeGroupEntry>) {
  const rawSongId = (entry.songId || entry.song_id)?.trim();
  const validSongId = rawSongId && isUUID(rawSongId) ? rawSongId : null;

  return {
    group_name: (entry.groupName || entry.group_name)?.trim() || 'Worship Team',
    target_date: entry.targetDate || entry.target_date || null,
    practice_date: entry.practiceDate || entry.practice_date || null,
    practice_time: (entry.practiceTime || entry.practice_time)?.trim() || null,
    assigned_event: (entry.assignedEvent || entry.assigned_event)?.trim() || null,
    song_id: validSongId,
    song_title: (entry.songTitle || entry.song_title)?.trim() || 'Untitled',
    lyrics_mode: entry.lyricsMode || entry.lyrics_mode || 'live',
    lyrics_snapshot: entry.lyricsSnapshot || entry.lyrics_snapshot || entry.lyrics || null,
    source_song_revision:
      entry.sourceSongRevision !== undefined && entry.sourceSongRevision !== null
        ? Number(entry.sourceSongRevision)
        : entry.source_song_revision !== undefined && entry.source_song_revision !== null
        ? Number(entry.source_song_revision)
        : null,
    notes: entry.notes?.trim() || null,
    is_done: Boolean(entry.isDone ?? entry.is_done ?? false),
  };
}

async function syncOwnerAttachments(
  ownerType: 'practice' | 'vocal_part',
  ownerId: string,
  attachments: SongAttachment[]
): Promise<void> {
  const { data: existingRows, error: fetchError } = await supabase
    .from('attachments')
    .select('id, position, revision')
    .eq('owner_type', ownerType)
    .eq('owner_id', ownerId)
    .is('deleted_at', null)
    .order('position', { ascending: true });

  if (fetchError) throw fetchError;

  const keptIds = new Set<string>();
  const usableAttachments = attachments.filter((attachment) =>
    Boolean((attachment.url || attachment.urlOrData || '').trim())
  );

  for (let position = 0; position < usableAttachments.length; position++) {
    const attachment = usableAttachments[position];
    const externalUrl = (attachment.url || attachment.urlOrData || '').trim();
    const match =
      (isUUID(attachment.id)
        ? existingRows?.find((row) => row.id === attachment.id)
        : undefined) || existingRows?.find((row) => row.position === position);

    const payload = {
      owner_type: ownerType,
      owner_id: ownerId,
      name: attachment.name?.trim() || 'Audio Track',
      category: attachment.category || null,
      kind: attachment.type || 'audio',
      media_id: null,
      external_url: externalUrl,
      text_content: null,
      position,
    };

    if (match) {
      const { data, error } = await supabase
        .from('attachments')
        .update(payload)
        .eq('id', match.id)
        .select('id')
        .single();
      if (error || !data) throw error || new Error('Failed to update attachment metadata');
      keptIds.add(data.id);
    } else {
      const { data, error } = await supabase
        .from('attachments')
        .insert(payload)
        .select('id')
        .single();
      if (error || !data) throw error || new Error('Failed to create attachment metadata');
      keptIds.add(data.id);
    }
  }

  for (const existing of existingRows || []) {
    if (!keptIds.has(existing.id)) {
      await executeSoftDelete('attachments', existing.id, Number(existing.revision) || 1);
    }
  }
}

async function syncPracticeVocalParts(
  practiceId: string,
  parts: PracticePartTrack[]
): Promise<void> {
  const { data: existingParts, error: fetchPartsErr } = await supabase
    .from('vocal_parts')
    .select('id, revision')
    .eq('practice_id', practiceId)
    .is('deleted_at', null);

  if (fetchPartsErr) {
    console.warn('Failed to fetch existing vocal parts:', formatSupabaseError(fetchPartsErr));
  }

  const keptPartIds = new Set<string>();

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const hasPartUUID = isUUID(p.id);

    const partPayload = {
      practice_id: practiceId,
      label: p.partLabel || 'Custom',
      custom_label: (p.customLabel || p.custom_label)?.trim() || null,
      name: p.name?.trim() || null,
      notes: p.notes?.trim() || null,
      position: i,
    };

    const matchPart = hasPartUUID ? existingParts?.find((ep) => ep.id === p.id) : null;
    let persistedPartId: string;
    if (matchPart) {
      keptPartIds.add(matchPart.id);
      const { error: updErr } = await supabase
        .from('vocal_parts')
        .update(partPayload)
        .eq('id', matchPart.id);
      if (updErr) {
        throw updErr;
      }
      persistedPartId = matchPart.id;
    } else {
      const { data: savedPart, error: partErr } = await supabase
        .from('vocal_parts')
        .insert(partPayload)
        .select('*')
        .single();
      if (!partErr && savedPart) {
        keptPartIds.add(savedPart.id);
        persistedPartId = savedPart.id;
      } else if (partErr) {
        throw partErr;
      } else {
        throw new Error('No vocal part returned after insert');
      }
    }

    const audioUrl = (p.audioUrl || p.urlOrData || '').trim();
    await syncOwnerAttachments(
      'vocal_part',
      persistedPartId!,
      audioUrl
        ? [
            {
              id: p.id,
              name: p.name || `${p.partLabel || 'Vocal'} Practice Track`,
              type: p.type || 'audio',
              url: audioUrl,
              urlOrData: audioUrl,
            },
          ]
        : []
    );
  }

  for (const ep of existingParts || []) {
    if (!keptPartIds.has(ep.id)) {
      try {
        await executeSoftDelete('vocal_parts', ep.id, Number(ep.revision) || 1);
      } catch {
        await supabase
          .from('vocal_parts')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', ep.id);
      }
    }
  }
}

/**
 * Saves one vocal contribution without updating its parent practice. This is the
 * member-safe path used for recorded/uploaded vocal parts; RLS restricts regular
 * members to rows they created while administrators retain full access.
 */
export async function savePracticeVocalPart(
  practiceId: string,
  part: PracticePartTrack,
  requestedPosition?: number
): Promise<PracticePartTrack> {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured');
  if (!practiceId || !isUUID(practiceId)) {
    throw new Error('Invalid practice ID for vocal part: ' + practiceId);
  }

  const { data: parent, error: parentError } = await supabase
    .from('practice_entries')
    .select('id')
    .eq('id', practiceId)
    .is('deleted_at', null)
    .maybeSingle();
  if (parentError) throw parentError;
  if (!parent) throw new Error('Practice no longer exists or could not be accessed.');

  const existingResult = isUUID(part.id)
    ? await supabase
        .from('vocal_parts')
        .select('*')
        .eq('id', part.id)
        .eq('practice_id', practiceId)
        .is('deleted_at', null)
        .maybeSingle()
    : { data: null, error: null };
  if (existingResult.error) throw existingResult.error;

  let position = requestedPosition;
  if (position === undefined || position < 0) {
    const { data: positions, error: positionError } = await supabase
      .from('vocal_parts')
      .select('position')
      .eq('practice_id', practiceId)
      .is('deleted_at', null)
      .order('position', { ascending: false })
      .limit(1);
    if (positionError) throw positionError;
    position = positions?.length ? Number(positions[0].position) + 1 : 0;
  }

  const payload = {
    practice_id: practiceId,
    label: part.partLabel || 'Custom',
    custom_label: (part.customLabel || part.custom_label)?.trim() || null,
    name: part.name?.trim() || null,
    notes: part.notes?.trim() || null,
    position,
  };

  const { data: savedPart, error: saveError } = existingResult.data
    ? await supabase
        .from('vocal_parts')
        .update(payload)
        .eq('id', existingResult.data.id)
        .select('*')
        .single()
    : await supabase.from('vocal_parts').insert(payload).select('*').single();

  if (saveError || !savedPart) {
    throw saveError || new Error('No vocal part returned after save');
  }

  const audioUrl = (part.audioUrl || part.urlOrData || '').trim();
  await syncOwnerAttachments(
    'vocal_part',
    savedPart.id,
    audioUrl
      ? [
          {
            id: part.id,
            name: part.name || `${part.partLabel || 'Vocal'} Practice Track`,
            type: part.type || 'audio',
            url: audioUrl,
            urlOrData: audioUrl,
          },
        ]
      : []
  );

  return {
    ...part,
    id: savedPart.id,
    position: savedPart.position,
    revision: Number(savedPart.revision) || 1,
    createdAt: savedPart.created_at,
  };
}

/** Save one rehearsal-track attachment without updating the parent practice. */
export async function savePracticeAttachment(
  practiceId: string,
  attachment: SongAttachment,
  requestedPosition?: number
): Promise<SongAttachment> {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured');
  if (!practiceId || !isUUID(practiceId)) {
    throw new Error('Invalid practice ID for attachment: ' + practiceId);
  }

  const existingResult = isUUID(attachment.id)
    ? await supabase
        .from('attachments')
        .select('*')
        .eq('id', attachment.id)
        .eq('owner_type', 'practice')
        .eq('owner_id', practiceId)
        .is('deleted_at', null)
        .maybeSingle()
    : { data: null, error: null };
  if (existingResult.error) throw existingResult.error;

  let position = requestedPosition;
  if (position === undefined || position < 0) {
    const { data: positions, error: positionError } = await supabase
      .from('attachments')
      .select('position')
      .eq('owner_type', 'practice')
      .eq('owner_id', practiceId)
      .is('deleted_at', null)
      .order('position', { ascending: false })
      .limit(1);
    if (positionError) throw positionError;
    position = positions?.length ? Number(positions[0].position) + 1 : 0;
  }

  const externalUrl = (attachment.url || attachment.urlOrData || '').trim();
  if (!externalUrl) throw new Error('A cloud media URL is required before saving the track.');
  const payload = {
    owner_type: 'practice',
    owner_id: practiceId,
    name: attachment.name?.trim() || 'Practice Track',
    category: attachment.category || null,
    kind: attachment.type || 'audio',
    media_id: null,
    external_url: externalUrl,
    text_content: null,
    position,
  };

  const { data, error } = existingResult.data
    ? await supabase
        .from('attachments')
        .update(payload)
        .eq('id', existingResult.data.id)
        .select('*')
        .single()
    : await supabase.from('attachments').insert(payload).select('*').single();
  if (error || !data) throw error || new Error('No attachment returned after save');
  return mapAttachmentFromDB(data);
}

export async function createPracticeEntry(
  entry: Partial<PracticeGroupEntry>
): Promise<PracticeGroupEntry> {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured');

  const validPayload = buildPracticePayload(entry);

  const { data, error } = await supabase
    .from('practice_entries')
    .insert(validPayload)
    .select('*')
    .single();

  if (error) {
    console.error('Supabase insert error on practice_entries:', formatSupabaseError(error), {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw error;
  }

  if (!data) {
    throw new Error('No data returned from practice insert.');
  }

  const newPracticeId = data.id;

  // Sync vocal parts if provided
  const parts = entry.parts || entry.vocalParts || [];
  if (parts.length > 0) {
    await syncPracticeVocalParts(newPracticeId, parts);
  }

  await syncOwnerAttachments(
    'practice',
    newPracticeId,
    entry.customAttachments || entry.attachments || []
  );

  const all = await fetchPracticeEntries();
  const refreshed = all.find((p) => p.id === newPracticeId);
  return refreshed || mapPracticeRowToEntry(data, parts);
}

export async function updatePracticeEntry(
  practiceId: string,
  entry: Partial<PracticeGroupEntry>
): Promise<PracticeGroupEntry> {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured');
  if (!practiceId || !isUUID(practiceId)) {
    throw new Error('Invalid practice ID for update: ' + practiceId);
  }

  const validPayload = buildPracticePayload(entry);

  const { data, error } = await supabase
    .from('practice_entries')
    .update(validPayload)
    .eq('id', practiceId)
    .select('*')
    .single();

  if (error) {
    console.error('Supabase update error on practice_entries:', formatSupabaseError(error), {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    if (error.code === 'PGRST116') {
      const notFoundErr = new Error('Practice no longer exists or could not be accessed.');
      (notFoundErr as any).code = 'PGRST116';
      (notFoundErr as any).details = error.details;
      (notFoundErr as any).hint = error.hint;
      throw notFoundErr;
    }
    throw error;
  }

  if (!data) {
    throw new Error('Practice no longer exists or could not be accessed.');
  }

  // Sync vocal parts if provided
  const parts = entry.parts || entry.vocalParts || [];
  await syncPracticeVocalParts(practiceId, parts);
  await syncOwnerAttachments(
    'practice',
    practiceId,
    entry.customAttachments || entry.attachments || []
  );

  const all = await fetchPracticeEntries();
  const refreshed = all.find((p) => p.id === practiceId);
  return refreshed || mapPracticeRowToEntry(data, parts);
}

export async function savePracticeEntry(
  entry: Partial<PracticeGroupEntry>,
  isNew = false
): Promise<PracticeGroupEntry> {
  if (isNew || !entry.id || !isUUID(entry.id)) {
    return createPracticeEntry(entry);
  }
  return updatePracticeEntry(entry.id, entry);
}

export async function deletePracticeEntry(id: string, expectedRevision?: number): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    if (expectedRevision !== undefined && expectedRevision > 0) {
      await executeSoftDelete('practice_entries', id, expectedRevision);
      return;
    }
  } catch (rpcErr) {
    console.warn('RPC soft delete fallback to direct soft delete for practice_entries:', rpcErr);
  }

  const { error } = await supabase
    .from('practice_entries')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    const errorDetails = formatSupabaseError(error);
    console.error('Failed to delete practice entry:', errorDetails, error);
    throw error;
  }
}

// -------------------------------------------------------------
// RECOGNITIONS: BIRTHDAYS, ANNIVERSARIES, VISITORS, SPECIALS
// -------------------------------------------------------------
export async function fetchBirthdays(): Promise<BirthdayCelebrant[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('birthdays')
    .select('*')
    .is('deleted_at', null)
    .order('birth_date', { ascending: true });

  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    birthDate: row.birth_date,
    birth_date: row.birth_date,
    ministryOrGroup: row.ministry_or_group || undefined,
    ministry_or_group: row.ministry_or_group || undefined,
    notes: row.notes || undefined,
    revision: Number(row.revision) || 1,
  }));
}

export async function saveBirthday(item: Partial<BirthdayCelebrant>, isNew = false): Promise<BirthdayCelebrant> {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured');

  const payload = {
    name: item.name?.trim() || 'Celebrant',
    birth_date: item.birthDate || item.birth_date || new Date().toISOString().slice(0, 10),
    ministry_or_group: (item.ministryOrGroup || item.ministry_or_group)?.trim() || null,
    notes: item.notes?.trim() || null,
  };

  const hasValidUUID = isUUID(item.id);

  if (isNew || !hasValidUUID) {
    const { data, error } = await supabase
      .from('birthdays')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) throw error || new Error('Failed to create birthday');
    return {
      id: data.id,
      name: data.name,
      birthDate: data.birth_date,
      ministryOrGroup: data.ministry_or_group || undefined,
      notes: data.notes || undefined,
      revision: Number(data.revision) || 1,
    };
  }

  const { data, error } = await supabase
    .from('birthdays')
    .update(payload)
    .eq('id', item.id)
    .eq('revision', item.revision || 1)
    .select('*')
    .single();

  if (error || !data) {
    throw new ConcurrencyConflictError(error?.message || 'Birthday record update conflict.');
  }

  return {
    id: data.id,
    name: data.name,
    birthDate: data.birth_date,
    ministryOrGroup: data.ministry_or_group || undefined,
    notes: data.notes || undefined,
    revision: Number(data.revision) || 1,
  };
}

export async function deleteBirthday(id: string, expectedRevision: number): Promise<void> {
  await executeSoftDelete('birthdays', id, expectedRevision);
}

export async function fetchAnniversaries(): Promise<AnniversaryCelebrant[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('anniversaries')
    .select('*')
    .is('deleted_at', null)
    .order('anniversary_date', { ascending: true });

  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    anniversaryDate: row.anniversary_date,
    anniversary_date: row.anniversary_date,
    type: row.type,
    yearsCount: row.years_count ?? undefined,
    years_count: row.years_count ?? undefined,
    notes: row.notes || undefined,
    revision: Number(row.revision) || 1,
  }));
}

export async function saveAnniversary(
  item: Partial<AnniversaryCelebrant>,
  isNew = false
): Promise<AnniversaryCelebrant> {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured');

  const payload = {
    title: item.title?.trim() || 'Anniversary',
    anniversary_date: item.anniversaryDate || item.anniversary_date || new Date().toISOString().slice(0, 10),
    type: item.type || 'Wedding',
    years_count: item.yearsCount ?? item.years_count ?? null,
    notes: item.notes?.trim() || null,
  };

  const hasValidUUID = isUUID(item.id);

  if (isNew || !hasValidUUID) {
    const { data, error } = await supabase
      .from('anniversaries')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) throw error || new Error('Failed to create anniversary');
    return {
      id: data.id,
      title: data.title,
      anniversaryDate: data.anniversary_date,
      type: data.type,
      yearsCount: data.years_count ?? undefined,
      notes: data.notes || undefined,
      revision: Number(data.revision) || 1,
    };
  }

  const { data, error } = await supabase
    .from('anniversaries')
    .update(payload)
    .eq('id', item.id)
    .eq('revision', item.revision || 1)
    .select('*')
    .single();

  if (error || !data) {
    throw new ConcurrencyConflictError(error?.message || 'Anniversary record update conflict.');
  }

  return {
    id: data.id,
    title: data.title,
    anniversaryDate: data.anniversary_date,
    type: data.type,
    yearsCount: data.years_count ?? undefined,
    notes: data.notes || undefined,
    revision: Number(data.revision) || 1,
  };
}

export async function deleteAnniversary(id: string, expectedRevision: number): Promise<void> {
  await executeSoftDelete('anniversaries', id, expectedRevision);
}

export async function fetchVisitors(): Promise<Visitor[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('visitors')
    .select('*')
    .is('deleted_at', null)
    .order('date_visited', { ascending: false });

  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    barangay: row.barangay || '',
    tier: row.tier,
    dateVisited: row.date_visited,
    date_visited: row.date_visited,
    contactNumber: row.contact_number || undefined,
    contact_number: row.contact_number || undefined,
    notes: row.notes || undefined,
    revision: Number(row.revision) || 1,
  }));
}

export async function saveVisitor(item: Partial<Visitor>, isNew = false): Promise<Visitor> {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured');

  const payload = {
    name: item.name?.trim() || 'Visitor',
    barangay: item.barangay?.trim() || null,
    tier: item.tier || '1st timer',
    date_visited: item.dateVisited || item.date_visited || new Date().toISOString().slice(0, 10),
    contact_number: (item.contactNumber || item.contact_number)?.trim() || null,
    notes: item.notes?.trim() || null,
  };

  const hasValidUUID = isUUID(item.id);

  if (isNew || !hasValidUUID) {
    const { data, error } = await supabase
      .from('visitors')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) throw error || new Error('Failed to create visitor');
    return {
      id: data.id,
      name: data.name,
      barangay: data.barangay || '',
      tier: data.tier,
      dateVisited: data.date_visited,
      contactNumber: data.contact_number || undefined,
      notes: data.notes || undefined,
      revision: Number(data.revision) || 1,
    };
  }

  const { data, error } = await supabase
    .from('visitors')
    .update(payload)
    .eq('id', item.id)
    .eq('revision', item.revision || 1)
    .select('*')
    .single();

  if (error || !data) {
    throw new ConcurrencyConflictError(error?.message || 'Visitor record update conflict.');
  }

  return {
    id: data.id,
    name: data.name,
    barangay: data.barangay || '',
    tier: data.tier,
    dateVisited: data.date_visited,
    contactNumber: data.contact_number || undefined,
    notes: data.notes || undefined,
    revision: Number(data.revision) || 1,
  };
}

export async function deleteVisitor(id: string, expectedRevision: number): Promise<void> {
  await executeSoftDelete('visitors', id, expectedRevision);
}

export async function fetchSpecialRecognitions(): Promise<SpecialRecognition[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('recognitions')
    .select('*')
    .is('deleted_at', null)
    .order('recognition_date', { ascending: false });

  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    recognitionType: row.recognition_type,
    recognition_type: row.recognition_type,
    customType: row.custom_type || undefined,
    custom_type: row.custom_type || undefined,
    date: row.recognition_date,
    recognition_date: row.recognition_date,
    description: row.description || undefined,
    revision: Number(row.revision) || 1,
  }));
}

export async function saveSpecialRecognition(
  item: Partial<SpecialRecognition>,
  isNew = false
): Promise<SpecialRecognition> {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured');

  const payload = {
    name: item.name?.trim() || 'Honoree',
    recognition_type: item.recognitionType || item.recognition_type || 'Newly Graduated',
    custom_type: (item.customType || item.custom_type)?.trim() || null,
    recognition_date: item.date || item.recognition_date || new Date().toISOString().slice(0, 10),
    description: item.description?.trim() || null,
  };

  const hasValidUUID = isUUID(item.id);

  if (isNew || !hasValidUUID) {
    const { data, error } = await supabase
      .from('recognitions')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) throw error || new Error('Failed to create recognition');
    return {
      id: data.id,
      name: data.name,
      recognitionType: data.recognition_type,
      customType: data.custom_type || undefined,
      date: data.recognition_date,
      description: data.description || undefined,
      revision: Number(data.revision) || 1,
    };
  }

  const { data, error } = await supabase
    .from('recognitions')
    .update(payload)
    .eq('id', item.id)
    .eq('revision', item.revision || 1)
    .select('*')
    .single();

  if (error || !data) {
    throw new ConcurrencyConflictError(error?.message || 'Recognition record update conflict.');
  }

  return {
    id: data.id,
    name: data.name,
    recognitionType: data.recognition_type,
    customType: data.custom_type || undefined,
    date: data.recognition_date,
    description: data.description || undefined,
    revision: Number(data.revision) || 1,
  };
}

export async function deleteSpecialRecognition(id: string, expectedRevision: number): Promise<void> {
  await executeSoftDelete('recognitions', id, expectedRevision);
}

// -------------------------------------------------------------
// APP SETTINGS DATA ACCESS
// -------------------------------------------------------------
export async function fetchAppSettings<T = any>(key: string, defaultValue: T): Promise<T> {
  if (!isSupabaseConfigured()) return defaultValue;

  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (error || !data) return defaultValue;
  return (data.value as T) ?? defaultValue;
}

export async function saveAppSettings(key: string, value: any): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const { error } = await supabase
    .from('app_settings')
    .upsert({ key, value }, { onConflict: 'key' });

  if (error) {
    console.warn(`Failed to save app_settings key=${key}:`, error);
  }
}

export async function fetchMinistrySavedNames(): Promise<string[]> {
  return fetchAppSettings<string[]>('ministry_saved_names', []);
}

export async function saveMinistrySavedNames(names: string[]): Promise<void> {
  return saveAppSettings('ministry_saved_names', names);
}

export function getDatabaseConnectionStatus(): DatabaseStatusInfo {
  return {
    status: isSupabaseConfigured() ? 'connected' : 'disconnected',
    provider: 'supabase',
    projectUrl: (import.meta.env.VITE_SUPABASE_URL as string) || '',
    tableLogs: {},
    lastSyncTime: Date.now(),
  };
}

// -------------------------------------------------------------
// REALTIME SUBSCRIPTIONS (Requirement 10)
// Subscribe once to Supabase Realtime changes for the necessary tables
// Handles INSERT, UPDATE, and soft-delete updates
// Cleans up all channel subscriptions when unmounting
// -------------------------------------------------------------
export interface RealtimeSyncCallbacks {
  onSongsChange?: (action: 'insert' | 'update' | 'delete', song: Song) => void;
  onSetlistsChange?: () => void;
  onSpecialNumbersChange?: (action: 'insert' | 'update' | 'delete', entry: SpecialNumberEntry) => void;
  onChoirChange?: (action: 'insert' | 'update' | 'delete', entry: ChoirEntry) => void;
  onPracticeChange?: () => void;
  onBirthdaysChange?: () => void;
  onAnniversariesChange?: () => void;
  onVisitorsChange?: () => void;
  onRecognitionsChange?: () => void;
  onProfilesChange?: () => void;
  onStatusChange?: (status: DatabaseStatusInfo) => void;
}

export function subscribeSupabaseRealtime(callbacks: RealtimeSyncCallbacks): () => void {
  if (!isSupabaseConfigured()) {
    callbacks.onStatusChange?.({
      status: 'disconnected',
      provider: 'supabase',
      projectUrl: '',
      tableLogs: {},
      lastSyncTime: null,
      errorMessage: 'Supabase credentials missing in environment variables',
    });
    return () => {};
  }

  const tableLogs: Record<string, TableSyncStatus> = {
    songs: { table: 'songs', displayName: 'Songs Catalog', itemCount: 0, lastEventTime: null, status: 'synced' },
    setlists: { table: 'setlists', displayName: 'Service Setlists', itemCount: 0, lastEventTime: null, status: 'synced' },
    special_numbers: { table: 'special_numbers', displayName: 'Special Numbers', itemCount: 0, lastEventTime: null, status: 'synced' },
    choir_entries: { table: 'choir_entries', displayName: 'Choir Presentations', itemCount: 0, lastEventTime: null, status: 'synced' },
    practice_entries: { table: 'practice_entries', displayName: 'Practices & Stems', itemCount: 0, lastEventTime: null, status: 'synced' },
    birthdays: { table: 'birthdays', displayName: 'Birthdays', itemCount: 0, lastEventTime: null, status: 'synced' },
    anniversaries: { table: 'anniversaries', displayName: 'Anniversaries', itemCount: 0, lastEventTime: null, status: 'synced' },
    visitors: { table: 'visitors', displayName: 'Visitors', itemCount: 0, lastEventTime: null, status: 'synced' },
    recognitions: { table: 'recognitions', displayName: 'Special Recognitions', itemCount: 0, lastEventTime: null, status: 'synced' },
    profiles: { table: 'profiles', displayName: 'Team Profiles', itemCount: 0, lastEventTime: null, status: 'synced' },
  };

  const updateTableEvent = (table: string) => {
    if (tableLogs[table]) {
      tableLogs[table].lastEventTime = Date.now();
      tableLogs[table].status = 'synced';
    }
    callbacks.onStatusChange?.({
      status: 'connected',
      provider: 'supabase',
      projectUrl: (import.meta.env.VITE_SUPABASE_URL as string) || '',
      tableLogs: { ...tableLogs },
      lastSyncTime: Date.now(),
    });
  };

  callbacks.onStatusChange?.({
    status: 'connecting',
    provider: 'supabase',
    projectUrl: (import.meta.env.VITE_SUPABASE_URL as string) || '',
    tableLogs: { ...tableLogs },
    lastSyncTime: null,
  });

  const channel = supabase
    .channel('qnlbc_database_realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'songs' },
      (payload) => {
        updateTableEvent('songs');
        if (payload.eventType === 'INSERT') {
          if (!payload.new.deleted_at) {
            callbacks.onSongsChange?.('insert', mapSongFromDB(payload.new));
          }
        } else if (payload.eventType === 'UPDATE') {
          if (payload.new.deleted_at) {
            callbacks.onSongsChange?.('delete', mapSongFromDB(payload.new));
          } else {
            callbacks.onSongsChange?.('update', mapSongFromDB(payload.new));
          }
        } else if (payload.eventType === 'DELETE') {
          callbacks.onSongsChange?.('delete', { id: payload.old.id } as Song);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'setlists' },
      () => {
        updateTableEvent('setlists');
        callbacks.onSetlistsChange?.();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'setlist_items' },
      () => {
        updateTableEvent('setlists');
        callbacks.onSetlistsChange?.();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'special_numbers' },
      (payload) => {
        updateTableEvent('special_numbers');
        if (payload.eventType === 'INSERT') {
          if (!payload.new.deleted_at) {
            callbacks.onSpecialNumbersChange?.('insert', mapSpecialNumberFromDB(payload.new));
          }
        } else if (payload.eventType === 'UPDATE') {
          if (payload.new.deleted_at) {
            callbacks.onSpecialNumbersChange?.('delete', mapSpecialNumberFromDB(payload.new));
          } else {
            callbacks.onSpecialNumbersChange?.('update', mapSpecialNumberFromDB(payload.new));
          }
        } else if (payload.eventType === 'DELETE') {
          callbacks.onSpecialNumbersChange?.('delete', { id: payload.old.id } as SpecialNumberEntry);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'choir_entries' },
      (payload) => {
        updateTableEvent('choir_entries');
        if (payload.eventType === 'INSERT') {
          if (!payload.new.deleted_at) {
            callbacks.onChoirChange?.('insert', mapChoirEntryFromDB(payload.new));
          }
        } else if (payload.eventType === 'UPDATE') {
          if (payload.new.deleted_at) {
            callbacks.onChoirChange?.('delete', mapChoirEntryFromDB(payload.new));
          } else {
            callbacks.onChoirChange?.('update', mapChoirEntryFromDB(payload.new));
          }
        } else if (payload.eventType === 'DELETE') {
          callbacks.onChoirChange?.('delete', { id: payload.old.id } as ChoirEntry);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'practice_entries' },
      () => {
        updateTableEvent('practice_entries');
        callbacks.onPracticeChange?.();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'vocal_parts' },
      () => {
        updateTableEvent('practice_entries');
        callbacks.onPracticeChange?.();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'attachments' },
      () => {
        updateTableEvent('practice_entries');
        callbacks.onPracticeChange?.();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'birthdays' },
      () => {
        updateTableEvent('birthdays');
        callbacks.onBirthdaysChange?.();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'anniversaries' },
      () => {
        updateTableEvent('anniversaries');
        callbacks.onAnniversariesChange?.();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'visitors' },
      () => {
        updateTableEvent('visitors');
        callbacks.onVisitorsChange?.();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'recognitions' },
      () => {
        updateTableEvent('recognitions');
        callbacks.onRecognitionsChange?.();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'profiles' },
      () => {
        updateTableEvent('profiles');
        callbacks.onProfilesChange?.();
      }
    )
    .subscribe((status) => {
      const isConnected = status === 'SUBSCRIBED';
      callbacks.onStatusChange?.({
        status: isConnected ? 'connected' : status === 'CHANNEL_ERROR' ? 'error' : 'connecting',
        provider: 'supabase',
        projectUrl: (import.meta.env.VITE_SUPABASE_URL as string) || '',
        tableLogs: { ...tableLogs },
        lastSyncTime: isConnected ? Date.now() : null,
        errorMessage: status === 'CHANNEL_ERROR' ? 'Supabase Realtime channel error' : undefined,
      });
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
