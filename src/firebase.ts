// Firebase configuration - loaded from .env variables
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Check if Firebase is properly configured
const isFirebaseConfigured = (): boolean => {
  return (
    !!firebaseConfig.apiKey &&
    firebaseConfig.apiKey !== 'your_api_key_here' &&
    !!firebaseConfig.projectId &&
    firebaseConfig.projectId !== 'your_project_id'
  );
};

// Lazy initialization - only initialize if properly configured
let app: ReturnType<typeof initializeApp> | null = null;
let storageInstance: FirebaseStorage | null = null;
let firestoreInstance: Firestore | null = null;

if (isFirebaseConfigured()) {
  try {
    app = initializeApp(firebaseConfig);
    // Only get analytics in browser context
    if (typeof window !== 'undefined') {
      getAnalytics(app);
    }
    storageInstance = getStorage(app);
    firestoreInstance = getFirestore(app);
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
} else {
  console.warn(
    'Firebase is not configured. PDF upload functionality will be unavailable. ' +
    'Please add your Firebase credentials to the .env file.'
  );
}

export const storage = storageInstance;
export const firestore = firestoreInstance;
export { app, isFirebaseConfigured };
