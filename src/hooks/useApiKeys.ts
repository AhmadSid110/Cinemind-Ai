// src/hooks/useApiKeys.ts
import { useState, useEffect } from 'react';
import { saveUserData } from '../firebase';

/**
 * Hook for managing API keys (TMDB, Gemini, OpenAI).
 * Handles localStorage persistence and cloud sync for keys.
 */
export function useApiKeys(user: any) {
  const [tmdbKey, setTmdbKey] = useState<string>(
    localStorage.getItem('tmdb_key') || ''
  );
  const [geminiKey, setGeminiKey] = useState<string>(
    localStorage.getItem('gemini_key') || (process.env.VITE_API_KEY as string) || ''
  );
  const [openaiKey, setOpenaiKey] = useState<string>(
    localStorage.getItem('openai_key') || ''
  );

  // Sync keys to cloud when user is logged in and keys change
  useEffect(() => {
    const syncKeysToCloud = async () => {
      if (!user) return;

      try {
        await saveUserData(user.uid, {
          tmdbKey,
          geminiKey,
          openaiKey,
        });
      } catch (err) {
        console.error('Error syncing keys to Firestore:', err);
      }
    };

    syncKeysToCloud();
  }, [user, tmdbKey, geminiKey, openaiKey]);

  const saveKeys = (
    newTmdbKey: string,
    newGeminiKey: string,
    newOpenaiKey: string
  ) => {
    localStorage.setItem('tmdb_key', newTmdbKey);
    localStorage.setItem('gemini_key', newGeminiKey);
    localStorage.setItem('openai_key', newOpenaiKey);

    setTmdbKey(newTmdbKey);
    setGeminiKey(newGeminiKey);
    setOpenaiKey(newOpenaiKey);
  };

  // Method to update keys from cloud (called by cloud sync)
  const updateKeysFromCloud = (
    cloudTmdbKey: string,
    cloudGeminiKey: string,
    cloudOpenaiKey: string
  ) => {
    if (cloudTmdbKey) {
      setTmdbKey(cloudTmdbKey);
      localStorage.setItem('tmdb_key', cloudTmdbKey);
    }
    if (cloudGeminiKey) {
      setGeminiKey(cloudGeminiKey);
      localStorage.setItem('gemini_key', cloudGeminiKey);
    }
    if (cloudOpenaiKey) {
      setOpenaiKey(cloudOpenaiKey);
      localStorage.setItem('openai_key', cloudOpenaiKey);
    }
  };

  return {
    tmdbKey,
    geminiKey,
    openaiKey,
    saveKeys,
    updateKeysFromCloud,
  };
}
