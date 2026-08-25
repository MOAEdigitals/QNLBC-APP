import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App singleton
export const firebaseApp = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApp();

// Initialize Firestore with custom database ID and auto-detect long polling for web/proxy environments
export const db = firebaseConfig.firestoreDatabaseId
  ? initializeFirestore(
      firebaseApp,
      {
        experimentalAutoDetectLongPolling: true,
      },
      firebaseConfig.firestoreDatabaseId
    )
  : initializeFirestore(firebaseApp, {
      experimentalAutoDetectLongPolling: true,
    });

