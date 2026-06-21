import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

function cleanEnvValue(value: string | undefined): string | undefined {
  return value?.trim().replace(/^["']+|["']+$/g, '');
}

const firebaseConfig = {
  apiKey: cleanEnvValue(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: cleanEnvValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: cleanEnvValue(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: cleanEnvValue(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: cleanEnvValue(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: cleanEnvValue(import.meta.env.VITE_FIREBASE_APP_ID),
  measurementId: cleanEnvValue(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID),
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

/**
 * Sign in with Google popup, return the Firebase ID token.
 */
export async function signInWithGoogle(): Promise<string> {
  const result = await signInWithPopup(auth, googleProvider);
  const idToken = await result.user.getIdToken();
  return idToken;
}

/**
 * Sign out from Firebase (client-side only, backend session cleared separately).
 */
export async function firebaseSignOut(): Promise<void> {
  await auth.signOut();
}
