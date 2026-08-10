// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getStorage } from "firebase/storage";

// Loaded from .env (VITE_FIREBASE_* vars) with safe fallback values for production deployments
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDemoKeyForARSPlatform2026",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "ars-platform-fe.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "ars-platform-fe",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "ars-platform-fe.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1029384756",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1029384756:web:abcdef123456",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-DEMO123456",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Safely initialize Analytics if supported in environment
let analytics = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported && firebaseConfig.projectId) {
      try {
        analytics = getAnalytics(app);
      } catch (err) {
        console.warn("Firebase Analytics initialization skipped:", err);
      }
    }
  }).catch(() => {
    // Ignore analytics error in fallback environments
  });
}

const storage = getStorage(app);

export { storage, analytics };