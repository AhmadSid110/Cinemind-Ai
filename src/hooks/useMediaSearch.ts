// src/hooks/useMediaSearch.ts
import { useState, useEffect } from 'react';
import { MediaItem, Episode, GeminiFilter } from '../types';
import * as tmdb from '../services/tmdbService';
import { analyzeQuery } from '../services/geminiService';

// Map Movie Genre IDs to TV Genre IDs
const GENRE_MAP_MOVIE_TO_TV: Record<number, number> = {
  28: 10759,    // Action -> Action & Adventure
  12: 10759,    // Adventure -> Action & Adventure
  878: 10765,   // Sci-Fi -> Sci-Fi & Fantasy
  14: 10765,    // Fantasy -> Sci-Fi & Fantasy
  10752: 10768, // War -> War & Politics
  // Note: Horror (27) is NOT mapped because it doesn't exist for TV.
};

function mapGenresToTV(movieGenreIds: number[]): number[] {
  return movieGenreIds
    .map((id) => GENRE_MAP_MOVIE_TO_TV[id] || (
      // Keep shared IDs
      [16, 35, 80, 99, 18, 10751, 9648, 37].includes(id) ? id : null
    ))
    .filter((id) => id !== null) as number[];
}

interface UseMediaSearchProps {
  tmdbKey: string;
  geminiKeys: string[]; 
  trendingMovies: MediaItem[];
  trendingTv: MediaItem[];
}

function normalizeMediaType(raw?: string | null): 'movie' | 'tv' | undefined {
  if (!raw) return undefined;
  const mt = raw.toLowerCase().trim();
  if (['movie', 'movies', 'film', 'films'].includes(mt)) return 'movie';
  if (['tv', 'tv_show', 'tv_shows', 'series', 'show', 'shows'].includes(mt)) return 'tv';
  return undefined;
}

export function useMediaSearch({
  tmdbKey,
  geminiKeys,
  trendingMovies,
  trendingTv,
}: UseMediaSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<MediaItem[]>([]);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<MediaItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSuggestLoading, setIsSuggestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-complete (unchanged)
  useEffect(() => {
    const q = searchQuery.trim();
    if (!tmdbKey || !q) { setSuggestions([]); return; }
    const handle = setTimeout(async () => {
      try {
        setIsSuggestLoading(true);
        const sug = await tmdb.getAutocompleteSuggestions(tmdbKey, q, 8);
        setSuggestions(sug);
      } catch (e) { console.warn(e); } finally { setIsSuggestLoading(false); }
    }, 300);
    return () => clearTimeout(handle);
  }, [searchQuery, tmdbKey]);

  const search = async () => {
    const trimmed = searchQuery.trim();
    if (!trimmed || !tmdbKey) return;

    setIsSearching(true);
    setResults([]); // Clear previous results immediately
    setExplanation(null);
    setError(null);

    try {
      if (!geminiKeys || geminiKeys.length === 0) {
        await performBasicSearch(trimmed);
        return;
      }

      // 1. AI Analysis
      const analysis = await analyzeQuery(trimmed, geminiKeys);
      const normalizedMediaType = normalizeMediaType((analysis as any).media_type);
      
      const topMatch = trimmed.match(/top\s+(\d+)/i);
      let targetLimit = analysis.limit || (topMatch ? parseInt(topMatch[1], 10) : 20);
      targetLimit = Math.min(Math.max(targetLimit, 1), 50);

      // --- TRENDING ---
      if (analysis.searchType === 'trending') {
        let items = [...trendingMovies, ...trendingTv];
        if (items.length === 0) items = await tmdb.getTrending(tmdbKey);
        setResults(items.slice(0, targetLimit));
        setExplanation(analysis.explanation || 'Trending content.');
        setIsSearching(false);
        return;
      }

      // --- DISCOVERY & FILTERING ---
      let finalGenres = analysis.genres || [];
      let validFilterSearch = true;

      // 🛑 CRITICAL FIX FOR TV HORROR 🛑
      // If asking for TV and "Horror" (27) is present, mapGenresToTV removes it.
      // If the resulting list is empty, it means we have NO valid TV genres.
      // In that case, we MUST force a text search.
      if (normalizedMediaType === 'tv' && finalGenres.length > 0) {
        const originalCount = finalGenres.length;
        finalGenres = mapGenresToTV(finalGenres);
        
        // If we had genres (like Horror) but they all got removed because they don't exist on TV...
        if (finalGenres.length === 0 && originalCount > 0) {
            console.log("All requested genres were invalid for TV (e.g. Horror). Switching to text search.");
            validFilterSearch = false; // Disable filter search, force text fallback
        }
      }

      let fetchedResults: MediaItem[] = [];
      const hasFilters = finalGenres.length > 0 || analysis.year || analysis.with_people || analysis.sort_by;

      // Only run Discovery if we have valid filters AND validFilterSearch is true
      if (validFilterSearch && hasFilters && normalizedMediaType) {
        fetchedResults = await tmdb.discoverMedia(tmdbKey, normalizedMediaType, {
            sort_by: analysis.sort_by || 'popularity.desc',
            'vote_count.gte': 200,
            with_genres: finalGenres.join(','),
            first_air_date_year: analysis.year,
            primary_release_year: analysis.year,
            with_people: analysis.with_people ? await tmdb.getPersonId(tmdbKey, analysis.with_people) : null,
            with_original_language: analysis.language,
        });
      }

      // Fallback: If Discovery was skipped OR returned 0 results
      if (fetchedResults.length === 0) {
        console.log("Zero results or invalid filters. Using text search.");
        const queryText = analysis.query || trimmed;
        fetchedResults = await tmdb.searchMulti(tmdbKey, queryText);
      }

      // Sort & Set
      if (analysis.sort_by === 'vote_average.desc') {
        fetchedResults.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
      }
      setResults(fetchedResults.slice(0, targetLimit));
      setExplanation(analysis.explanation || 'Here is what I found.');

    } catch (e) {
      console.error(e);
      await performBasicSearch(trimmed);
      setExplanation("Standard search results.");
    } finally {
      setIsSearching(false);
    }
  };

  const performBasicSearch = async (q: string) => {
    const res = await tmdb.searchMulti(tmdbKey, q);
    setResults(res);
  };

  const selectSuggestion = (item: MediaItem) => {
    setSearchQuery(item.title || item.name || '');
    setResults([item]);
    setSuggestions([]);
  };

  return { searchQuery, setSearchQuery, results, explanation, suggestions, isSearching, isSuggestLoading, error, search, selectSuggestion };
}
