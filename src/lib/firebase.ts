import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "REDACTED_FIREBASE_API_KEY",
  authDomain: "ifsolucionesautomotrices.firebaseapp.com",
  projectId: "ifsolucionesautomotrices",
  storageBucket: "ifsolucionesautomotrices.firebasestorage.app",
  messagingSenderId: "610108589353",
  appId: "1:610108589353:web:528c3d4d141edc52be6338",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
