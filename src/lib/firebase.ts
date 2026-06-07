import { deleteApp, initializeApp, getApps } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export function getSecondaryAuth() {
  const secondaryAppName = "if-soluciones-user-admin";
  const existing = getApps().find((a) => a.name === secondaryAppName);
  const secondaryApp = existing ?? initializeApp(firebaseConfig, secondaryAppName);
  return getAuth(secondaryApp);
}

export default app;

export async function createAuthUser(email: string, password: string): Promise<string> {
  const secondaryApp = initializeApp(firebaseConfig, `user-creation-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await signOut(secondaryAuth).catch(() => {});
    return credential.user.uid;
  } finally {
    await deleteApp(secondaryApp).catch(() => {});
  }
}
