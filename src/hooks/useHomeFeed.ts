// src/hooks/useHomeFeed.ts
import { useState, useEffect } from 'react';
import { MediaItem } from '../types';
import * as tmdb from '../services/tmdbService';

/**
 * Hook for home feed data (trending movies/TV, now playing, on air).
 * Auto-fetches data internally based on tmdbKey availability.
 */
export function useHomeFeed(tmdbKey: string) {
  const [trendingMovies, setTrendingMovies] = useState<MediaItem[]>([]);
  const [trendingTv, setTrendingTv] = useState<MediaItem[]>([]);
  const [inTheaters, setInTheaters] = useState<MediaItem[]>([]);
  const [streamingNow, setStreamingNow] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-load home sections when tmdbKey is available
  useEffect(() => {
    const loadHomeSections = async () => {
      if (!tmdbKey) return;

      setLoading(true);
      setError(null);

      try {
        const [
          moviesTrending,
          tvTrending,
          moviesNowPlaying,
          tvOnAir,
        ] = await Promise.all([
          tmdb.getTrendingMovies(tmdbKey),
          tmdb.getTrendingTv(tmdbKey),
          tmdb.getNowPlayingMovies(tmdbKey),
          tmdb.getOnTheAirTv(tmdbKey),
        ]);

        setTrendingMovies(moviesTrending);
        setTrendingTv(tvTrending);
        setInTheaters(moviesNowPlaying);
        setStreamingNow(tvOnAir);
      } catch (e) {
        console.error('Error loading home feed:', e);
        setError('Failed to load home content. Check your TMDB key or network.');
      } finally {
        setLoading(false);
      }
    };

    loadHomeSections();
  }, [tmdbKey]);

  return {
    trendingMovies,
    trendingTv,
    inTheaters,
    streamingNow,
    loading,
    error,
  };
}
