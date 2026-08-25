import {
  collection,
  doc,
  setDoc,
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
  USERS: 'users',
};

// Generic sanitize helper to avoid undefined fields in Firestore
function sanitizeDoc<T>(data: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(data as any)) {
    if (value !== undefined) {
      clean[key] = value;
    }
  }
  return clean;
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

/**
 * Initial Cloud Seeding:
 * If the cloud database is empty on first run, seed it with local data so all devices receive it.
 */
export async function initializeFirestoreCloudSeed() {
  try {
    const songsCol = collection(db, COLLECTIONS.SONGS);
    const existingSongs = await getDocs(songsCol);

    if (existingSongs.empty) {
      console.log('Seeding initial cloud data to Firestore...');
      const initialSongs = loadSongs();
      for (const s of initialSongs) {
        await setDoc(doc(db, COLLECTIONS.SONGS, s.id), sanitizeDoc(s), { merge: true });
      }

      const initialSetlists = loadSetlists();
      for (const setlist of initialSetlists) {
        await setDoc(doc(db, COLLECTIONS.SETLISTS, setlist.id), sanitizeDoc(setlist), { merge: true });
      }

      const initialSpecialNumbers = loadSpecialNumbers();
      for (const sp of initialSpecialNumbers) {
        await setDoc(doc(db, COLLECTIONS.SPECIAL_NUMBERS, sp.id), sanitizeDoc(sp), { merge: true });
      }

      const initialPractice = loadPracticeEntries();
      for (const pr of initialPractice) {
        await setDoc(doc(db, COLLECTIONS.PRACTICE_ENTRIES, pr.id), sanitizeDoc(pr), { merge: true });
      }

      const initialBirthdays = loadBirthdays();
      for (const b of initialBirthdays) {
        await setDoc(doc(db, COLLECTIONS.BIRTHDAYS, b.id), sanitizeDoc(b), { merge: true });
      }

      const initialAnniv = loadAnniversaries();
      for (const a of initialAnniv) {
        await setDoc(doc(db, COLLECTIONS.ANNIVERSARIES, a.id), sanitizeDoc(a), { merge: true });
      }

      const initialVisitors = loadVisitors();
      for (const v of initialVisitors) {
        await setDoc(doc(db, COLLECTIONS.VISITORS, v.id), sanitizeDoc(v), { merge: true });
      }

      const initialRecognitions = loadSpecialRecognitions();
      for (const r of initialRecognitions) {
        await setDoc(doc(db, COLLECTIONS.SPECIAL_RECOGNITIONS, r.id), sanitizeDoc(r), { merge: true });
      }

      const initialUsers = loadUsers();
      for (const u of initialUsers) {
        await setDoc(doc(db, COLLECTIONS.USERS, u.id), sanitizeDoc(u), { merge: true });
      }
    }
  } catch (err) {
    console.warn('Initial cloud seed skipped or error:', err);
  }
}
