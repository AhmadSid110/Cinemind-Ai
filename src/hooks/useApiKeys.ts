// src/hooks/useApiKeys.ts
import { useState, useEffect } from 'react';

/**
 * Hook for managing API keys (TMDB, Gemini, OpenAI).
 * Handles localStorage persistence. Cloud sync is handled by useCloudSync hook.
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
  const [omdbKey, setOmdbKey] = useState<string>(
    localStorage.getItem('omdb_key') || ''
  );

  const saveKeys = (
    newTmdbKey: string,
    newGeminiKey: string,
    newOpenaiKey: string,
    newOmdbKey: string
  ) => {
    localStorage.setItem('tmdb_key', newTmdbKey);
    localStorage.setItem('gemini_key', newGeminiKey);
    localStorage.setItem('openai_key', newOpenaiKey);
    localStorage.setItem('omdb_key', newOmdbKey);

    setTmdbKey(newTmdbKey);
    setGeminiKey(newGeminiKey);
    setOpenaiKey(newOpenaiKey);
    setOmdbKey(newOmdbKey);
  };

  // Method to update keys from cloud (called by cloud sync)
  const updateKeysFromCloud = (
    cloudTmdbKey: string,
    cloudGeminiKey: string,
    cloudOpenaiKey: string,
    cloudOmdbKey?: string
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
    if (cloudOmdbKey) {
      setOmdbKey(cloudOmdbKey);
      localStorage.setItem('omdb_key', cloudOmdbKey);
    }
  };

  return {
    tmdbKey,
    geminiKey,
    openaiKey,
    omdbKey,
    saveKeys,
    updateKeysFromCloud,
  };
}
