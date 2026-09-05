// Firebase configuration - loaded from .env variables
import { initializeApp } from "firebase/app";
import { getAnalytics, type Analytics } from "firebase/analytics";
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

/**
 * Snapshot of which Firebase env vars are populated (or not). Used by the
 * service layer to produce accurate error messages — we don't want to blame
 * the .env file when the env vars ARE set but a Firebase call is failing for
 * a different reason (server outage, network, security rules, etc.).
 *
 * Each entry is `true` when the value is non-empty and not a placeholder.
 * Exposed for diagnostics so the UI can hint at the real problem.
 */
export interface FirebaseConfigStatus {
  configured: boolean;
  apiKeyPresent: boolean;
  projectIdPresent: boolean;
  missingKeys: readonly string[];
}

const PLACEHOLDER_VALUES = new Set(['your_api_key_here', 'your_project_id']);

const isRealValue = (value: string | undefined): boolean =>
  typeof value === 'string' && value.trim().length > 0 && !PLACEHOLDER_VALUES.has(value.trim());

/**
 * Inspect the raw env-var slots so we can pinpoint WHICH Firebase key is
 * missing — much more useful than "Firebase is not configured" when only
 * `VITE_FIREBASE_AUTH_DOMAIN` is empty.
 */
export const getFirebaseConfigStatus = (): FirebaseConfigStatus => {
  const apiKeyPresent = isRealValue(firebaseConfig.apiKey);
  const projectIdPresent = isRealValue(firebaseConfig.projectId);
  const missingKeys: string[] = [];
  if (!apiKeyPresent) missingKeys.push('VITE_FIREBASE_API_KEY');
  if (!isRealValue(firebaseConfig.authDomain)) missingKeys.push('VITE_FIREBASE_AUTH_DOMAIN');
  if (!projectIdPresent) missingKeys.push('VITE_FIREBASE_PROJECT_ID');
  if (!isRealValue(firebaseConfig.storageBucket)) missingKeys.push('VITE_FIREBASE_STORAGE_BUCKET');
  if (!isRealValue(firebaseConfig.messagingSenderId)) missingKeys.push('VITE_FIREBASE_MESSAGING_SENDER_ID');
  if (!isRealValue(firebaseConfig.appId)) missingKeys.push('VITE_FIREBASE_APP_ID');
  return {
    configured: apiKeyPresent && projectIdPresent,
    apiKeyPresent,
    projectIdPresent,
    missingKeys,
  };
};

// Lazy initialization - only initialize if properly configured
let app: ReturnType<typeof initializeApp> | null = null;
let storageInstance: FirebaseStorage | null = null;
let firestoreInstance: Firestore | null = null;
let analyticsInstance: Analytics | null = null;

// Capture the init error so the UI can surface it (instead of silently
// falling through to a misleading "Firebase is not configured" message).
let firebaseInitError: Error | null = null;

if (isFirebaseConfigured()) {
  try {
    app = initializeApp(firebaseConfig);

    // Storage first — it never depends on anything else and is what
    // manuscript PDF uploads use. If the env vars are bad at least
    // we'll surface a clear error before touching Firestore.
    try {
      storageInstance = getStorage(app);
    } catch (storageError) {
      // eslint-disable-next-line no-console
      console.error('Firebase Storage failed to initialize:', storageError);
      throw storageError;
    }

    // Firestore next — Policies editor, Post moderation, and any other
    // collection-backed feature call into this. We isolate it so a
    // Firestore init failure doesn't take Storage down with it.
    try {
      firestoreInstance = getFirestore(app);
    } catch (firestoreError) {
      // eslint-disable-next-line no-console
      console.error('Firebase Firestore failed to initialize:', firestoreError);
    }

    // Analytics is purely nice-to-have; if it fails we still want the
    // rest of Firebase to work. Wrap in its own try/catch and only init
    // when measurementId is present (otherwise the SDK can refuse to
    // register with the same "Service analytics is not available" /
    // "Component analytics has not been registered yet" error that the
    // older code was crashing on).
    if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
      try {
        analyticsInstance = getAnalytics(app);
      } catch (analyticsError) {
        // eslint-disable-next-line no-console
        console.warn(
          'Firebase Analytics failed to initialize; continuing without it.',
          analyticsError,
        );
      }
    }
  } catch (error) {
    firebaseInitError = error instanceof Error ? error : new Error(String(error));
    // eslint-disable-next-line no-console
    console.error('Firebase initialization error:', error);
  }
} else {
  // eslint-disable-next-line no-console
  console.warn(
    'Firebase is not configured. PDF upload functionality will be unavailable. ' +
    'Please add your Firebase credentials to the .env file.'
  );
}

export const storage = storageInstance;
export const firestore = firestoreInstance;
export const analytics = analyticsInstance;
export { app, isFirebaseConfigured };
export const firebaseInitializationError = firebaseInitError;
