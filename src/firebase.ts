import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App singleton
export const firebaseApp = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApp();

export const auth = getAuth(firebaseApp);

// Initialize Cloud Storage for Universal Media (MP3s, WAV stems, attachments)
export const storage = getStorage(
  firebaseApp,
  (firebaseConfig as any).storageBucket || undefined
);

// Initialize Firestore with custom database ID and force long polling for web/proxy/iframe environments
const customDbId = (firebaseConfig as any).firestoreDatabaseId;
export const db = customDbId
  ? initializeFirestore(
      firebaseApp,
      {
        experimentalForceLongPolling: true,
      },
      customDbId
    )
  : initializeFirestore(firebaseApp, {
      experimentalForceLongPolling: true,
    });


