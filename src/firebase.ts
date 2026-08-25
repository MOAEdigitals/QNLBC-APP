import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App singleton
export const firebaseApp = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApp();

// Initialize Firestore with configured custom database ID if present
export const db = firebaseConfig.firestoreDatabaseId
  ? initializeFirestore(firebaseApp, {}, firebaseConfig.firestoreDatabaseId)
  : getFirestore(firebaseApp);
