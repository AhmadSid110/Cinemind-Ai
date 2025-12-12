// src/services/cacheMerge.ts
import { RatingEntry } from "./cloudCacheService";

export function mergeRatingsMaps(
  local: Record<string, RatingEntry>,
  remote: Record<string, RatingEntry> | null
): Record<string, RatingEntry> {
  if (!remote) return { ...local };
  const merged: Record<string, RatingEntry> = { ...(local || {}) };

  for (const key of Object.keys(remote)) {
    const r = remote[key];
    const l = merged[key];
    if (!l) {
      merged[key] = r;
    } else {
      // choose the one with newest fetchedAt
      if ((r.fetchedAt || 0) > (l.fetchedAt || 0)) merged[key] = r;
      // else keep local
    }
  }
  return merged;
}
