// src/firebase.ts
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "firebase/firestore";

// ✅ Your Firebase config (SAFE in frontend)
const firebaseConfig = {
  apiKey: "AIzaSyA0ZDf40vugmhexsaesRKHRtEx1BV2vMJ8",
  authDomain: "cinemind-ai-c5118.firebaseapp.com",
  projectId: "cinemind-ai-c5118",
  storageBucket: "cinemind-ai-c5118.appspot.com", // ✅ corrected
  messagingSenderId: "872246031292",
  appId: "1:872246031292:web:bff5e11a9400a6322671b9",
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);

// ✅ Auth & Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);

// ✅ Google provider
const provider = new GoogleAuthProvider();

/* ─────────────────────────
   AUTH HELPERS
───────────────────────── */

export function subscribeToAuthChanges(cb: (user: any | null) => void) {
  return onAuthStateChanged(auth, cb);
}

export async function loginWithGoogle() {
  const res = await signInWithPopup(auth, provider);
  return res.user;
}

/* ─────────────────────────
   USER DATA HELPERS
───────────────────────── */

export async function loadUserData(uid: string) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function saveUserData(uid: string, data: any) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, data, { merge: true });
}
