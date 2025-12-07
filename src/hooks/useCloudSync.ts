// src/hooks/useCloudSync.ts
import { useState, useEffect, useRef } from 'react';
import { loadUserData, saveUserData } from '../firebase';
import { AppState } from '../types';

interface UseCloudSyncProps {
  user: any;
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}

/**
 * Hook for Firestore cloud synchronization.
 * Handles loading user data from cloud and continuous sync.
 */
export function useCloudSync({ user, state, setState }: UseCloudSyncProps) {
  const [syncing, setSyncing] = useState(false);
  const [hasLoadedCloud, setHasLoadedCloud] = useState(false);

  // Load user data from cloud when user logs in
  useEffect(() => {
    const loadFromCloud = async () => {
      if (!user) {
        setHasLoadedCloud(false);
        return;
      }

      try {
        setSyncing(true);
        const cloud = await loadUserData(user.uid);

        if (cloud) {
          const nextFavorites = cloud.favorites || [];
          const nextWatchlist = cloud.watchlist || [];
          const nextTmdbKey = cloud.tmdbKey || '';
          const nextGeminiKey = cloud.geminiKey || '';
          const nextOpenaiKey = cloud.openaiKey || '';
          const nextUserRatings = cloud.userRatings || {};

          setState((prev) => ({
            ...prev,
            favorites: nextFavorites,
            watchlist: nextWatchlist,
            tmdbKey: nextTmdbKey || prev.tmdbKey,
            geminiKey: nextGeminiKey || prev.geminiKey,
            openaiKey: nextOpenaiKey || prev.openaiKey,
            userRatings: nextUserRatings,
          }));

          // sync localStorage to cloud
          localStorage.setItem('favorites', JSON.stringify(nextFavorites));
          localStorage.setItem('watchlist', JSON.stringify(nextWatchlist));
          localStorage.setItem('userRatings', JSON.stringify(nextUserRatings));
          if (nextTmdbKey) localStorage.setItem('tmdb_key', nextTmdbKey);
          if (nextGeminiKey) localStorage.setItem('gemini_key', nextGeminiKey);
          if (nextOpenaiKey) localStorage.setItem('openai_key', nextOpenaiKey);
        } else {
          console.log('[SYNC] No cloud doc yet, will push local as initial');
        }
      } catch (err) {
        console.error('Error loading user cloud data:', err);
      } finally {
        setSyncing(false);
        setHasLoadedCloud(true);
      }
    };

    loadFromCloud();
  }, [user, setState]);

  // Continuous sync to Firestore
  useEffect(() => {
    const syncToCloud = async () => {
      if (!user || !hasLoadedCloud) return;

      try {
        setSyncing(true);
        await saveUserData(user.uid, {
          favorites: state.favorites,
          watchlist: state.watchlist,
          tmdbKey: state.tmdbKey,
          geminiKey: state.geminiKey,
          openaiKey: state.openaiKey,
          userRatings: state.userRatings,
        });
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
    state.tmdbKey,
    state.geminiKey,
    state.openaiKey,
    state.userRatings,
  ]);

  return {
    syncing,
  };
}
