// src/hooks/useCloudSync.ts
import { useState, useEffect, useRef } from 'react';
import { loadUserData, saveUserData } from '../firebase';
import { AppState } from '../types';

interface UseCloudSyncProps {
  user: any;
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  updateKeysFromCloud?: (tmdbKey: string, geminiKey: string, openaiKey: string) => void;
}

/**
 * Hook for Firestore cloud synchronization.
 * Handles loading user data from cloud and continuous sync.
 */
export function useCloudSync({ user, state, setState, updateKeysFromCloud }: UseCloudSyncProps) {
  const [syncing, setSyncing] = useState(false);
  const [hasLoadedCloud, setHasLoadedCloud] = useState(false);
  
  // Track the last synced data to prevent unnecessary syncs
  const lastSyncedData = useRef<string>('');

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
          const nextUserRatings = cloud.userRatings || {};

          setState((prev) => ({
            ...prev,
            favorites: nextFavorites,
            watchlist: nextWatchlist,
            userRatings: nextUserRatings,
          }));

          // sync localStorage
          localStorage.setItem('favorites', JSON.stringify(nextFavorites));
          localStorage.setItem('watchlist', JSON.stringify(nextWatchlist));
          localStorage.setItem('userRatings', JSON.stringify(nextUserRatings));

          // Update the last synced data to prevent immediate re-sync
          lastSyncedData.current = JSON.stringify({
            favorites: nextFavorites,
            watchlist: nextWatchlist,
            userRatings: nextUserRatings,
          });

          // Update keys via callback if provided
          if (updateKeysFromCloud) {
            const nextTmdbKey = cloud.tmdbKey || '';
            const nextGeminiKey = cloud.geminiKey || '';
            const nextOpenaiKey = cloud.openaiKey || '';
            updateKeysFromCloud(nextTmdbKey, nextGeminiKey, nextOpenaiKey);
          }
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
  }, [user, setState, updateKeysFromCloud]);

  // Continuous sync to Firestore (favorites, watchlist, ratings only)
  useEffect(() => {
    const syncToCloud = async () => {
      if (!user || !hasLoadedCloud) return;

      // Create a stable representation of the data to sync
      const dataToSync = {
        favorites: state.favorites,
        watchlist: state.watchlist,
        userRatings: state.userRatings,
      };
      
      // Stringify the data to compare with previous sync
      const currentDataString = JSON.stringify(dataToSync);
      
      // Skip sync if data hasn't actually changed
      if (currentDataString === lastSyncedData.current) {
        return;
      }

      try {
        setSyncing(true);
        await saveUserData(user.uid, dataToSync);
        // Update the last synced data after successful sync
        lastSyncedData.current = currentDataString;
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
  ]);

  return {
    syncing,
  };
}
