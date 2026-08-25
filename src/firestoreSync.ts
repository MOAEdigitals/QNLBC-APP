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
  } catch (err) {
    console.warn('Initial cloud seed skipped or error:', err);
  }
}
