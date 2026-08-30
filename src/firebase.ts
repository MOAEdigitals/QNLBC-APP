import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App singleton
export const firebaseApp = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApp();

export const auth = getAuth(firebaseApp);

// Initialize Firestore with custom database ID and auto-detect long polling for web/proxy environments
const customDbId = (firebaseConfig as any).firestoreDatabaseId;
export const db = customDbId
  ? initializeFirestore(
      firebaseApp,
      {
        experimentalAutoDetectLongPolling: true,
      },
      customDbId
    )
  : initializeFirestore(firebaseApp, {
      experimentalAutoDetectLongPolling: true,
    });


