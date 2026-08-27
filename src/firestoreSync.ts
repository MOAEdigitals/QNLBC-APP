import {
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  Setlist,
  Song,
  BirthdayCelebrant,
  AnniversaryCelebrant,
  Visitor,
  SpecialRecognition,
  SpecialNumberEntry,
  PracticeGroupEntry,
  UserAccount,
} from './types';
import {
  loadSetlists,
  loadSongs,
  loadBirthdays,
  loadAnniversaries,
  loadVisitors,
  loadSpecialRecognitions,
  loadSpecialNumbers,
  loadPracticeEntries,
  loadSavedNames,
  loadWelcomeSongs,
  loadUsers,
} from './utils/storage';

const COLLECTIONS = {
  SETLISTS: 'setlists',
  SONGS: 'songs',
  BIRTHDAYS: 'birthdays',
  ANNIVERSARIES: 'anniversaries',
  VISITORS: 'visitors',
  SPECIAL_RECOGNITIONS: 'special_recognitions',
  SPECIAL_NUMBERS: 'special_numbers',
  PRACTICE_ENTRIES: 'practice_entries',
  SAVED_NAMES: 'saved_names',
  WELCOME_SONGS: 'welcome_songs',
  PRACTICE_AUDIOS: 'practice_audios',
  APP_SETTINGS: 'app_settings',
  USERS: 'users',
};

// Generic recursive sanitize helper to avoid undefined fields and payload limits in Firestore documents
function sanitizeDoc<T>(data: T): Record<string, any> {
  if (data === null || data === undefined) return {} as Record<string, any>;

  const cleanObject = (obj: any): any => {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') {
      // Guard against oversized base64 data URLs in Firestore documents (> 200KB)
      if (typeof obj === 'string' && obj.startsWith('data:') && obj.length > 200000) {
        return 'indexeddb:local_storage';
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj
        .filter((item) => item !== undefined)
        .map((item) => cleanObject(item));
    }

    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        clean[key] = cleanObject(value);
      }
    }
    return clean;
  };

  return cleanObject(data);
}

// Subscribe to real-time updates for any collection
export function subscribeToCollection<T extends { id: string }>(
  collectionName: string,
  onUpdate: (items: T[]) => void
) {
  const colRef = collection(db, collectionName);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: T[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ ...(docSnap.data() as T), id: docSnap.id });
      });
      onUpdate(items);
    },
    (err) => {
      console.warn(`Real-time sync error on ${collectionName}:`, err);
    }
  );
}

// Firestore Write Operations
export async function syncSaveSetlist(setlist: Setlist) {
  try {
    const docRef = doc(db, COLLECTIONS.SETLISTS, setlist.id);
    await setDoc(docRef, sanitizeDoc(setlist), { merge: true });
  } catch (err) {
    console.error('Error syncing setlist to Firestore:', err);
  }
}

export async function syncDeleteSetlist(id: string) {
  try {
    await deleteDoc(doc(db, COLLECTIONS.SETLISTS, id));
  } catch (err) {
    console.error('Error deleting setlist from Firestore:', err);
  }
}

export async function syncSaveSong(song: Song) {
  try {
    const docRef = doc(db, COLLECTIONS.SONGS, song.id);
    await setDoc(docRef, sanitizeDoc(song), { merge: true });
  } catch (err) {
    console.error('Error syncing song to Firestore:', err);
  }
}

export async function syncDeleteSong(id: string) {
  try {
    await deleteDoc(doc(db, COLLECTIONS.SONGS, id));
  } catch (err) {
    console.error('Error deleting song from Firestore:', err);
  }
}

export async function syncSaveSpecialNumber(entry: SpecialNumberEntry) {
  try {
    const docRef = doc(db, COLLECTIONS.SPECIAL_NUMBERS, entry.id);
    await setDoc(docRef, sanitizeDoc(entry), { merge: true });
  } catch (err) {
    console.error('Error syncing special number to Firestore:', err);
  }
}

export async function syncDeleteSpecialNumber(id: string) {
  try {
    await deleteDoc(doc(db, COLLECTIONS.SPECIAL_NUMBERS, id));
  } catch (err) {
    console.error('Error deleting special number from Firestore:', err);
  }
}

export async function syncSavePracticeEntry(entry: PracticeGroupEntry) {
  try {
    const docRef = doc(db, COLLECTIONS.PRACTICE_ENTRIES, entry.id);
    await setDoc(docRef, sanitizeDoc(entry), { merge: true });
  } catch (err) {
    console.error('Error syncing practice entry to Firestore:', err);
  }
}

export async function syncDeletePracticeEntry(id: string) {
  try {
    await deleteDoc(doc(db, COLLECTIONS.PRACTICE_ENTRIES, id));
  } catch (err) {
    console.error('Error deleting practice entry from Firestore:', err);
  }
}

export async function syncSaveBirthday(item: BirthdayCelebrant) {
  try {
    const docRef = doc(db, COLLECTIONS.BIRTHDAYS, item.id);
    await setDoc(docRef, sanitizeDoc(item), { merge: true });
  } catch (err) {
    console.error('Error syncing birthday to Firestore:', err);
  }
}

export async function syncDeleteBirthday(id: string) {
  try {
    await deleteDoc(doc(db, COLLECTIONS.BIRTHDAYS, id));
  } catch (err) {
    console.error('Error deleting birthday from Firestore:', err);
  }
}

export async function syncSaveAnniversary(item: AnniversaryCelebrant) {
  try {
    const docRef = doc(db, COLLECTIONS.ANNIVERSARIES, item.id);
    await setDoc(docRef, sanitizeDoc(item), { merge: true });
  } catch (err) {
    console.error('Error syncing anniversary to Firestore:', err);
  }
}

export async function syncDeleteAnniversary(id: string) {
  try {
    await deleteDoc(doc(db, COLLECTIONS.ANNIVERSARIES, id));
  } catch (err) {
    console.error('Error deleting anniversary from Firestore:', err);
  }
}

export async function syncSaveVisitor(item: Visitor) {
  try {
    const docRef = doc(db, COLLECTIONS.VISITORS, item.id);
    await setDoc(docRef, sanitizeDoc(item), { merge: true });
  } catch (err) {
    console.error('Error syncing visitor to Firestore:', err);
  }
}

export async function syncDeleteVisitor(id: string) {
  try {
    await deleteDoc(doc(db, COLLECTIONS.VISITORS, id));
  } catch (err) {
    console.error('Error deleting visitor from Firestore:', err);
  }
}

export async function syncSaveSpecialRecognition(item: SpecialRecognition) {
  try {
    const docRef = doc(db, COLLECTIONS.SPECIAL_RECOGNITIONS, item.id);
    await setDoc(docRef, sanitizeDoc(item), { merge: true });
  } catch (err) {
    console.error('Error syncing special recognition to Firestore:', err);
  }
}

export async function syncDeleteSpecialRecognition(id: string) {
  try {
    await deleteDoc(doc(db, COLLECTIONS.SPECIAL_RECOGNITIONS, id));
  } catch (err) {
    console.error('Error deleting special recognition from Firestore:', err);
  }
}

export async function syncSaveUser(user: UserAccount) {
  try {
    const docRef = doc(db, COLLECTIONS.USERS, user.id);
    await setDoc(docRef, sanitizeDoc(user), { merge: true });
  } catch (err) {
    console.error('Error syncing user account to Firestore:', err);
  }
}

export async function syncDeleteUser(id: string, username?: string) {
  try {
    if (id) {
      await deleteDoc(doc(db, COLLECTIONS.USERS, id));
    }
    if (username) {
      const usersCol = collection(db, COLLECTIONS.USERS);
      const snap = await getDocs(usersCol);
      for (const d of snap.docs) {
        const data = d.data();
        if (
          d.id === id ||
          d.id.toLowerCase() === username.toLowerCase() ||
          (data.username && data.username.toLowerCase() === username.toLowerCase())
        ) {
          await deleteDoc(doc(db, COLLECTIONS.USERS, d.id));
        }
      }
    }
  } catch (err) {
    console.error('Error deleting user from Firestore:', err);
  }
}

// --- Practice Audio Cloud Sync (Cross-Device Audio Stem & Voice Memo Sync) ---
const MAX_CHUNK_SIZE = 700000; // 700KB chunk size to stay safely within Firestore 1MB document limit

export async function syncSavePracticeAudio(id: string, dataUrl: string, title?: string): Promise<void> {
  if (!id || !dataUrl) return;
  const cleanId = id.replace(/^indexeddb:/, '');

  try {
    if (dataUrl.length <= MAX_CHUNK_SIZE) {
      // Single document
      const docRef = doc(db, COLLECTIONS.PRACTICE_AUDIOS, cleanId);
      await setDoc(
        docRef,
        {
          id: cleanId,
          dataUrl,
          title: title || '',
          isChunked: false,
          size: dataUrl.length,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } else {
      // Chunked document for larger recordings/files
      const totalChunks = Math.ceil(dataUrl.length / MAX_CHUNK_SIZE);
      const docRef = doc(db, COLLECTIONS.PRACTICE_AUDIOS, cleanId);
      await setDoc(
        docRef,
        {
          id: cleanId,
          title: title || '',
          isChunked: true,
          totalChunks,
          size: dataUrl.length,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      for (let i = 0; i < totalChunks; i++) {
        const chunk = dataUrl.substring(i * MAX_CHUNK_SIZE, (i + 1) * MAX_CHUNK_SIZE);
        const chunkDocRef = doc(db, COLLECTIONS.PRACTICE_AUDIOS, `${cleanId}_chunk_${i}`);
        await setDoc(chunkDocRef, { chunkIndex: i, data: chunk, parentId: cleanId });
      }
    }
  } catch (err) {
    console.error(`Error saving audio to Firestore (${cleanId}):`, err);
  }
}

export async function fetchPracticeAudioFromCloud(id: string): Promise<string | null> {
  if (!id) return null;
  const cleanId = id.replace(/^indexeddb:/, '');

  try {
    const docRef = doc(db, COLLECTIONS.PRACTICE_AUDIOS, cleanId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;

    const data = docSnap.data();
    if (!data.isChunked && data.dataUrl) {
      return data.dataUrl;
    }

    if (data.isChunked && data.totalChunks) {
      let combined = '';
      for (let i = 0; i < data.totalChunks; i++) {
        const chunkDocRef = doc(db, COLLECTIONS.PRACTICE_AUDIOS, `${cleanId}_chunk_${i}`);
        const chunkSnap = await getDoc(chunkDocRef);
        if (chunkSnap.exists() && chunkSnap.data().data) {
          combined += chunkSnap.data().data;
        } else {
          return null; // Missing chunk
        }
      }
      return combined || null;
    }

    return null;
  } catch (err) {
    console.warn(`Error fetching audio from cloud (${cleanId}):`, err);
    return null;
  }
}

export async function syncDeletePracticeAudio(id: string): Promise<void> {
  if (!id) return;
  const cleanId = id.replace(/^indexeddb:/, '');

  try {
    const docRef = doc(db, COLLECTIONS.PRACTICE_AUDIOS, cleanId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.isChunked && data.totalChunks) {
        for (let i = 0; i < data.totalChunks; i++) {
          await deleteDoc(doc(db, COLLECTIONS.PRACTICE_AUDIOS, `${cleanId}_chunk_${i}`));
        }
      }
      await deleteDoc(docRef);
    }
  } catch (err) {
    console.error(`Error deleting audio from cloud (${cleanId}):`, err);
  }
}

/**
 * Real-time subscription to cloud practice audio attachments and voice takes.
 * When any choir member/worship leader uploads or records on their device,
 * other devices receive the audio updates automatically.
 */
export function subscribeToPracticeAudios(
  onAudioUpdated: (audioId: string, dataUrl: string) => void
) {
  const colRef = collection(db, COLLECTIONS.PRACTICE_AUDIOS);
  return onSnapshot(
    colRef,
    (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const data = change.doc.data();
          const docId = change.doc.id;
          // Skip internal child chunk documents
          if (docId.includes('_chunk_') || data.chunkIndex !== undefined) {
            return;
          }

          if (!data.isChunked && data.dataUrl) {
            onAudioUpdated(docId, data.dataUrl);
          } else if (data.isChunked) {
            const fullData = await fetchPracticeAudioFromCloud(docId);
            if (fullData) {
              onAudioUpdated(docId, fullData);
            }
          }
        }
      });
    },
    (err) => {
      console.warn('Real-time sync error on practice_audios:', err);
    }
  );
}

// --- Settings Cloud Sync (Church Directory & Welcome Songs) ---

export async function syncSaveSavedNames(names: string[]): Promise<void> {
  try {
    const docRef = doc(db, COLLECTIONS.APP_SETTINGS, 'saved_names');
    await setDoc(docRef, { id: 'saved_names', names, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.error('Error syncing saved names to Firestore:', err);
  }
}

export async function syncSaveWelcomeSongs(songs: string[]): Promise<void> {
  try {
    const docRef = doc(db, COLLECTIONS.APP_SETTINGS, 'welcome_songs');
    await setDoc(docRef, { id: 'welcome_songs', songs, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.error('Error syncing welcome songs to Firestore:', err);
  }
}

export function subscribeToAppSettings(
  onUpdateSavedNames: (names: string[]) => void,
  onUpdateWelcomeSongs: (songs: string[]) => void
) {
  const namesDocRef = doc(db, COLLECTIONS.APP_SETTINGS, 'saved_names');
  const songsDocRef = doc(db, COLLECTIONS.APP_SETTINGS, 'welcome_songs');

  const unsubNames = onSnapshot(
    namesDocRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.names)) {
          onUpdateSavedNames(data.names);
        }
      }
    },
    (err) => console.warn('Error subscribing to saved_names:', err)
  );

  const unsubSongs = onSnapshot(
    songsDocRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (Array.isArray(data.songs)) {
          onUpdateWelcomeSongs(data.songs);
        }
      }
    },
    (err) => console.warn('Error subscribing to welcome_songs:', err)
  );

  return () => {
    unsubNames();
    unsubSongs();
  };
}

/**
 * Initial Cloud Seeding:
 * Checks each collection individually. If any collection is empty on Firestore,
 * seeds it with default/local data so all devices immediately get in sync.
 */
export async function initializeFirestoreCloudSeed() {
  try {
    // 1. Songs
    const songsCol = collection(db, COLLECTIONS.SONGS);
    const existingSongs = await getDocs(songsCol);
    if (existingSongs.empty) {
      const initialSongs = loadSongs();
      for (const s of initialSongs) {
        await setDoc(doc(db, COLLECTIONS.SONGS, s.id), sanitizeDoc(s), { merge: true });
      }
    }

    // 2. Setlists
    const setlistsCol = collection(db, COLLECTIONS.SETLISTS);
    const existingSetlists = await getDocs(setlistsCol);
    if (existingSetlists.empty) {
      const initialSetlists = loadSetlists();
      for (const setlist of initialSetlists) {
        await setDoc(doc(db, COLLECTIONS.SETLISTS, setlist.id), sanitizeDoc(setlist), { merge: true });
      }
    } else {
      // If user created local setlists before internet connected or while offline, ensure they are synced to Firestore
      const localSetlists = loadSetlists();
      const existingIds = new Set(existingSetlists.docs.map((d) => d.id));
      for (const s of localSetlists) {
        if (!existingIds.has(s.id)) {
          await setDoc(doc(db, COLLECTIONS.SETLISTS, s.id), sanitizeDoc(s), { merge: true });
        }
      }
    }

    // 3. Special Numbers
    const specialCol = collection(db, COLLECTIONS.SPECIAL_NUMBERS);
    const existingSpecials = await getDocs(specialCol);
    if (existingSpecials.empty) {
      const initialSpecialNumbers = loadSpecialNumbers();
      for (const sp of initialSpecialNumbers) {
        await setDoc(doc(db, COLLECTIONS.SPECIAL_NUMBERS, sp.id), sanitizeDoc(sp), { merge: true });
      }
    }

    // 4. Practice Entries
    const practiceCol = collection(db, COLLECTIONS.PRACTICE_ENTRIES);
    const existingPractice = await getDocs(practiceCol);
    if (existingPractice.empty) {
      const initialPractice = loadPracticeEntries();
      for (const pr of initialPractice) {
        await setDoc(doc(db, COLLECTIONS.PRACTICE_ENTRIES, pr.id), sanitizeDoc(pr), { merge: true });
      }
    }

    // 5. Birthdays
    const birthdaysCol = collection(db, COLLECTIONS.BIRTHDAYS);
    const existingBirthdays = await getDocs(birthdaysCol);
    if (existingBirthdays.empty) {
      const initialBirthdays = loadBirthdays();
      for (const b of initialBirthdays) {
        await setDoc(doc(db, COLLECTIONS.BIRTHDAYS, b.id), sanitizeDoc(b), { merge: true });
      }
    }

    // 6. Anniversaries
    const annivCol = collection(db, COLLECTIONS.ANNIVERSARIES);
    const existingAnniv = await getDocs(annivCol);
    if (existingAnniv.empty) {
      const initialAnniv = loadAnniversaries();
      for (const a of initialAnniv) {
        await setDoc(doc(db, COLLECTIONS.ANNIVERSARIES, a.id), sanitizeDoc(a), { merge: true });
      }
    }

    // 7. Visitors
    const visitorsCol = collection(db, COLLECTIONS.VISITORS);
    const existingVisitors = await getDocs(visitorsCol);
    if (existingVisitors.empty) {
      const initialVisitors = loadVisitors();
      for (const v of initialVisitors) {
        await setDoc(doc(db, COLLECTIONS.VISITORS, v.id), sanitizeDoc(v), { merge: true });
      }
    }

    // 8. Special Recognitions
    const recognitionsCol = collection(db, COLLECTIONS.SPECIAL_RECOGNITIONS);
    const existingRecognitions = await getDocs(recognitionsCol);
    if (existingRecognitions.empty) {
      const initialRecognitions = loadSpecialRecognitions();
      for (const r of initialRecognitions) {
        await setDoc(doc(db, COLLECTIONS.SPECIAL_RECOGNITIONS, r.id), sanitizeDoc(r), { merge: true });
      }
    }

    // 9. Users
    const usersCol = collection(db, COLLECTIONS.USERS);
    const existingUsers = await getDocs(usersCol);
    if (existingUsers.empty) {
      const initialUsers = loadUsers();
      for (const u of initialUsers) {
        await setDoc(doc(db, COLLECTIONS.USERS, u.id), sanitizeDoc(u), { merge: true });
      }
    }

    // 10. Saved Directory Names (App Settings)
    const savedNamesDoc = await getDoc(doc(db, COLLECTIONS.APP_SETTINGS, 'saved_names'));
    if (!savedNamesDoc.exists()) {
      const initialNames = loadSavedNames();
      await setDoc(doc(db, COLLECTIONS.APP_SETTINGS, 'saved_names'), {
        id: 'saved_names',
        names: initialNames,
        updatedAt: new Date().toISOString(),
      });
    }

    // 11. Welcome Songs (App Settings)
    const welcomeSongsDoc = await getDoc(doc(db, COLLECTIONS.APP_SETTINGS, 'welcome_songs'));
    if (!welcomeSongsDoc.exists()) {
      const initialWelcome = loadWelcomeSongs();
      await setDoc(doc(db, COLLECTIONS.APP_SETTINGS, 'welcome_songs'), {
        id: 'welcome_songs',
        songs: initialWelcome,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('Initial cloud seed skipped or error:', err);
  }
}
