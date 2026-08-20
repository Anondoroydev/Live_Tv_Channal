import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, setLogLevel } from 'firebase/firestore';

const DEFAULT_FIREBASE_CONFIG = {
  projectId: "neat-comfort-7tvkm",
  appId: "1:615203301975:web:88630c7d3626cc26145112",
  apiKey: "AIzaSyANuwaGxmt2Tv9SAkW2PAWaQ7E2F2IjAbQ",
  authDomain: "neat-comfort-7tvkm.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-remixremixremixr-66b7eff1-8688-4e15-8635-2b7b51a27253",
  storageBucket: "neat-comfort-7tvkm.firebasestorage.app",
  messagingSenderId: "615203301975",
};

const firebaseConfig = {
  projectId: (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID) || DEFAULT_FIREBASE_CONFIG.projectId,
  appId: (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_FIREBASE_APP_ID) || DEFAULT_FIREBASE_CONFIG.appId,
  apiKey: (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_FIREBASE_API_KEY) || DEFAULT_FIREBASE_CONFIG.apiKey,
  authDomain: (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN) || DEFAULT_FIREBASE_CONFIG.authDomain,
  firestoreDatabaseId: (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_FIREBASE_DATABASE_ID) || DEFAULT_FIREBASE_CONFIG.firestoreDatabaseId,
  storageBucket: (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET) || DEFAULT_FIREBASE_CONFIG.storageBucket,
  messagingSenderId: (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID) || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
};

// Suppress internal Firestore idle stream disconnect and gRPC retry notices
try {
  setLogLevel('silent');
} catch (e) {}

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let firestoreInstance: any = null;
try {
  if (firebaseConfig.firestoreDatabaseId) {
    firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  } else {
    firestoreInstance = getFirestore(app);
  }
} catch (e) {
  try {
    firestoreInstance = getFirestore(app);
  } catch (err) {
    console.warn("Firestore initialization error in client:", err);
  }
}

export const db = firestoreInstance;

