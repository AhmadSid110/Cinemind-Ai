// src/hooks/useCloudSync.ts
import { useState, useEffect, useRef } from 'react';
import { loadUserData, saveUserData } from '../firebase';
import { AppState } from '../types';

interface UseCloudSyncProps {
  user: any;
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  tmdbKey: string;
  geminiKey: string;
  openaiKey: string;
  // updates the key hook (useApiKeys) from cloud
  updateKeysFromCloud?: (tmdbKey: string, geminiKey: string, openaiKey: string) => void;
}

/**
 * Hook for Firestore cloud synchronization.
 * - Loads user data ONCE per login.
 * - Continuously syncs changes (favorites, watchlist, ratings, API keys)
 *   but only when data really changed (using a stable JSON snapshot).
 */
export function useCloudSync({
  user,
  state,
  setState,
  tmdbKey,
  geminiKey,
  openaiKey,
  updateKeysFromCloud,
}: UseCloudSyncProps) {
  const [syncing, setSyncing] = useState(false);
  const [hasLoadedCloud, setHasLoadedCloud] = useState(false);

  // Holds the last data that was successfully synced to Firestore
  const lastSyncedData = useRef<string | null>(null);

  /**
   * Load user document from Firestore whenever the AUTH USER changes.
   * IMPORTANT: dependency array is ONLY [user] to avoid re-running on every render.
   */
  useEffect(() => {
    // When user logs out, reset flags & snapshot
    if (!user) {
      setHasLoadedCloud(false);
      lastSyncedData.current = null;
      return;
    }

    let cancelled = false;

    const loadFromCloud = async () => {
      try {
        setSyncing(true);
        const cloud = await loadUserData(user.uid);

        if (cancelled) return;

        if (cloud) {
          const nextFavorites = cloud.favorites || [];
          const nextWatchlist = cloud.watchlist || [];
          const nextUserRatings = cloud.userRatings || {};

          const nextTmdbKey = cloud.tmdbKey || '';
          const nextGeminiKey = cloud.geminiKey || '';
          const nextOpenaiKey = cloud.openaiKey || '';

          // Update app state with cloud library content
          setState((prev) => ({
            ...prev,
            favorites: nextFavorites,
            watchlist: nextWatchlist,
            userRatings: nextUserRatings,
          }));

          // Keep localStorage in sync with cloud
          localStorage.setItem('favorites', JSON.stringify(nextFavorites));
          localStorage.setItem('watchlist', JSON.stringify(nextWatchlist));
          localStorage.setItem('userRatings', JSON.stringify(nextUserRatings));

          // Push API keys into the key hook (useApiKeys)
          if (updateKeysFromCloud) {
            updateKeysFromCloud(nextTmdbKey, nextGeminiKey, nextOpenaiKey);
          }

          // This snapshot MUST match the shape used by syncToCloud
          lastSyncedData.current = JSON.stringify({
            favorites: nextFavorites,
            watchlist: nextWatchlist,
            userRatings: nextUserRatings,
            tmdbKey: nextTmdbKey,
            geminiKey: nextGeminiKey,
            openaiKey: nextOpenaiKey,
          });

          console.log('[SYNC] Loaded data from cloud and set initial snapshot');
        } else {
          console.log('[SYNC] No cloud doc yet, first local change will create one');
          lastSyncedData.current = null;
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error loading user cloud data:', err);
        }
      } finally {
        if (!cancelled) {
          setSyncing(false);
          setHasLoadedCloud(true);
        }
      }
    };

    loadFromCloud();

    return () => {
      cancelled = true;
    };
  // ⛔ DO NOT include setState or updateKeysFromCloud here – they change every render
  }, [user, setState, updateKeysFromCloud]); // if ESLint complains, you can safely reduce to [user]

  /**
   * Continuous sync to Firestore after initial cloud load.
   * Only runs when:
   *   - user is logged in
   *   - initial cloud load has completed
   *   - current data != lastSyncedData snapshot
   */
  useEffect(() => {
    if (!user) return;
    if (!hasLoadedCloud) return;

    // Build the exact payload we will sync
    const dataToSync = {
      favorites: state.favorites,
      watchlist: state.watchlist,
      userRatings: state.userRatings,
      tmdbKey,
      geminiKey,
      openaiKey,
    };

    const currentDataString = JSON.stringify(dataToSync);

    // If nothing has changed since last sync, do nothing
    if (currentDataString === lastSyncedData.current) {
      // Uncomment if you want to debug
      // console.log('[SYNC] Skipping sync - no changes detected');
      return;
    }

    let cancelled = false;

    const syncToCloud = async () => {
      try {
        setSyncing(true);
        console.log('[SYNC] Changes detected, syncing to cloud...');
        await saveUserData(user.uid, dataToSync);
        if (!cancelled) {
          lastSyncedData.current = currentDataString;
          console.log('[SYNC] Sync complete, snapshot updated');
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error syncing to Firestore:', err);
        }
      } finally {
        if (!cancelled) {
          setSyncing(false);
        }
      }
    };

    syncToCloud();

    return () => {
      cancelled = true;
    };
  }, [
    user,
    hasLoadedCloud,
    state.favorites,
    state.watchlist,
    state.userRatings,
    tmdbKey,
    geminiKey,
    openaiKey,
  ]);

  return {
    syncing,
  };
}