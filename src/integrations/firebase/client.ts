import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDnt7_5qaemOPfE0yLyOs-a2v1DRkzZqh0",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "alqiyada-24.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "alqiyada-24",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "alqiyada-24.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1027371606927",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1027371606927:web:dc393d291290590bf4e1fa",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-DFBP6Q0162",
};

export const isFirebaseConfigured = Boolean(firebaseConfig.projectId && firebaseConfig.appId);
export const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);
export { firebaseConfig };
