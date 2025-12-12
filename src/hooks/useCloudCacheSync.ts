// src/hooks/useCloudCacheSync.ts
import { useEffect, useRef } from "react";
import { fetchUserRatingsCache, writeUserRatingsCache } from "../services/cloudCacheService";
import { mergeRatingsMaps } from "../services/cacheMerge";

export function useCloudCacheSync({
  user,
  ratingsCache,
  enabled,
}: {
  user: any | null;
  ratingsCache: any | null;
  enabled: boolean;
}) {
  const uploadDebounce = useRef<any>(null);

  // On login: download, merge, import into local cache
  useEffect(() => {
    if (!user?.uid || !ratingsCache || !enabled) return;

    let cancelled = false;

    (async () => {
      try {
        const remote = await fetchUserRatingsCache(user.uid);
        if (cancelled) return;
        const local = ratingsCache.rawMap || {};
        const merged = mergeRatingsMaps(local, remote);
        // import merged map into ratingsCache
        ratingsCache.importMap?.(merged);

        // push merged back to cloud (ensure cloud contains local entries too)
        // do this after a tiny delay to avoid racing with multiple devices
        setTimeout(() => {
          writeUserRatingsCache(user.uid, merged).catch(console.error);
        }, 1200);
      } catch (e) {
        console.error("Cloud sync download/merge failed", e);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.uid, ratingsCache, enabled]);

  // Watch local map and debounce upload (2s)
  useEffect(() => {
    if (!user?.uid || !ratingsCache || !enabled) return;

    const upload = async () => {
      try {
        // Before upload: prune large / stale data if you want.
        const payload = ratingsCache.rawMap || {};
        await writeUserRatingsCache(user.uid, payload);
      } catch (e) {
        console.error("Cloud sync upload failed", e);
      }
    };

    // Debounce manual implementation
    if (uploadDebounce.current) {
      clearTimeout(uploadDebounce.current);
    }
    uploadDebounce.current = setTimeout(() => {
      upload();
      uploadDebounce.current = null;
    }, 2200);

    return () => {
      if (uploadDebounce.current) {
        clearTimeout(uploadDebounce.current);
        uploadDebounce.current = null;
      }
    };
  }, [user?.uid, ratingsCache?.rawMap, ratingsCache, enabled]);

  // Return a small object if caller wants status in future
  return {};
}
