// src/services/cloudCacheService.ts
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

export type RatingEntry = {
  imdbId?: string | null;
  imdbRating?: string | null;
  imdbVotes?: string | null;
  metascore?: string | null;
  rottenTomatoes?: string | null;
  fetchedAt: number;
};

export async function fetchUserRatingsCache(uid: string): Promise<Record<string, RatingEntry> | null> {
  if (!uid) return null;
  const ref = doc(db, "userCaches", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() || {};
  return (data.ratingsMap || null) as Record<string, RatingEntry> | null;
}

export async function writeUserRatingsCache(uid: string, ratingsMap: Record<string, RatingEntry>) {
  if (!uid) throw new Error("No uid");
  const ref = doc(db, "userCaches", uid);
  // overwrite/merge rating map (we merge client-side before calling this)
  await setDoc(ref, {
    ratingsMap,
    lastSyncedAt: Date.now(),
  }, { merge: true });
}
