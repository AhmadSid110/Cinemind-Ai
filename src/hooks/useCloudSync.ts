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
  /**
   * Called when cloud has API keys – should update local key state + localStorage.
   */
  updateKeysFromCloud?: (
    tmdbKey: string,
    geminiKey: string,
    openaiKey: string
  ) => void;
}

/**
 * Hook for Firestore cloud synchronization.
 * - Loads user data once when user logs in
 * - Then pushes changes (favorites, watchlist, ratings, keys) only when they change
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

  // Stable snapshot of last data we actually synced
  const lastSyncedData = useRef<string>('');

  // ------------ LOAD FROM CLOUD WHEN USER CHANGES ------------
  useEffect(() => {
    let cancelled = false;

    const loadFromCloud = async () => {
      if (!user) {
        // user logged out
        setHasLoadedCloud(false);
        lastSyncedData.current = '';
        return;
      }

      try {
        setSyncing(true);
        const cloud = await loadUserData(user.uid);

        if (!cloud) {
          console.log('[SYNC] No cloud doc yet, will push local as initial');
          return;
        }

        const nextFavorites = cloud.favorites || [];
        const nextWatchlist = cloud.watchlist || [];
        const nextUserRatings = cloud.userRatings || {};

        // Prefer cloud keys, but fall back to current ones if missing
        const nextTmdbKey = cloud.tmdbKey ?? tmdbKey ?? '';
        const nextGeminiKey = cloud.geminiKey ?? geminiKey ?? '';
        const nextOpenaiKey = cloud.openaiKey ?? openaiKey ?? '';

        if (cancelled) return;

        // Update library state from cloud
        setState(prev => ({
          ...prev,
          favorites: nextFavorites,
          watchlist: nextWatchlist,
          userRatings: nextUserRatings,
        }));

        // Sync localStorage for library
        localStorage.setItem('favorites', JSON.stringify(nextFavorites));
        localStorage.setItem('watchlist', JSON.stringify(nextWatchlist));
        localStorage.setItem('userRatings', JSON.stringify(nextUserRatings));

        // Tell the key hook to update its state + localStorage
        if (updateKeysFromCloud) {
          updateKeysFromCloud(nextTmdbKey, nextGeminiKey, nextOpenaiKey);
        } else {
          // If callback not provided, at least keep localStorage consistent
          localStorage.setItem('tmdb_key', nextTmdbKey);
          localStorage.setItem('gemini_key', nextGeminiKey);
          localStorage.setItem('openai_key', nextOpenaiKey);
        }

        // Set the "last synced" snapshot to exactly what we'll push later
        lastSyncedData.current = JSON.stringify({
          favorites: nextFavorites,
          watchlist: nextWatchlist,
          userRatings: nextUserRatings,
          tmdbKey: nextTmdbKey,
          geminiKey: nextGeminiKey,
          openaiKey: nextOpenaiKey,
        });
      } catch (err) {
        console.error('Error loading user cloud data:', err);
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
    // 🔴 IMPORTANT: we intentionally DO NOT include updateKeysFromCloud here
    // or it would re-run on every render. We only want this when `user` changes.
  }, [user, setState, tmdbKey, geminiKey, openaiKey]);

  // ------------ CONTINUOUS SYNC TO CLOUD WHEN DATA CHANGES ------------
  useEffect(() => {
    const syncToCloud = async () => {
      if (!user || !hasLoadedCloud) return;

      const dataToSync = {
        favorites: state.favorites,
        watchlist: state.watchlist,
        userRatings: state.userRatings,
        tmdbKey,
        geminiKey,
        openaiKey,
      };

      const currentDataString = JSON.stringify(dataToSync);

      // If nothing changed since last successful sync, skip
      if (currentDataString === lastSyncedData.current) {
        // console.log('[SYNC] Skipping sync - no data changes detected');
        return;
      }

      try {
        setSyncing(true);
        console.log('[SYNC] Syncing data to cloud...');
        await saveUserData(user.uid, dataToSync);
        lastSyncedData.current = currentDataString;
        console.log('[SYNC] Successfully synced to cloud');
      } catch (err) {
        console.error('Error syncing to Firestore:', err);
      } finally {
        setSyncing(false);
      }
    };

    syncToCloud();
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