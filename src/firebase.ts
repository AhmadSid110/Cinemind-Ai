// src/firebase.ts
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';

// Your Firebase config (frontend-safe)
const firebaseConfig = {
  apiKey: 'AIzaSyA0ZDf40vugmhexsaesRKHRtEx1BV2vMJ8',
  authDomain: 'cinemind-ai-c5118.firebaseapp.com',
  projectId: 'cinemind-ai-c5118',
  storageBucket: 'cinemind-ai-c5118.appspot.com',
  messagingSenderId: '872246031292',
  appId: '1:872246031292:web:bff5e11a9400a6322671b9',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Google provider (existing)
const provider = new GoogleAuthProvider();

/* ----------------------
   AUTH HELPERS
   ---------------------- */

export function subscribeToAuthChanges(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}

export async function loginWithGoogle() {
  const res = await signInWithPopup(auth, provider);
  return res.user;
}

/**
 * Register new user with email + password
 * returns firebase User on success
 */
export async function registerWithEmail(email: string, password: string) {
  const res = await createUserWithEmailAndPassword(auth, email, password);
  return res.user;
}

/**
 * Sign in with email + password
 */
export async function loginWithEmail(email: string, password: string) {
  const res = await signInWithEmailAndPassword(auth, email, password);
  return res.user;
}

/**
 * Send password reset email
 */
export async function sendResetEmail(email: string, actionUrl?: string) {
  // actionUrl is optional - you can pass a continueUrl if you configured Firebase Auth dynamic links
  return sendPasswordResetEmail(auth, email, actionUrl ? { url: actionUrl } : undefined);
}

/**
 * Sign out
 */
export async function logout() {
  return signOut(auth);
}

/* ----------------------
   USER DATA HELPERS
   ---------------------- */

export async function loadUserData(uid: string) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function saveUserData(uid: string, data: any) {
  const ref = doc(db, 'users', uid);
  await setDoc(ref, data, { merge: true });
}
