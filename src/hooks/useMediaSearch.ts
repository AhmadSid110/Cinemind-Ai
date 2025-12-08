// src/hooks/useMediaSearch.ts
import { useState, useEffect } from 'react';
import { MediaItem, GeminiFilter } from '../types';
import * as tmdb from '../services/tmdbService';
import { analyzeQuery } from '../services/geminiService';

const GENRE_MAP_MOVIE_TO_TV: Record<number, number> = {
  28: 10759,    // Action -> Action & Adventure
  12: 10759,    // Adventure -> Action & Adventure
  878: 10765,   // Sci-Fi -> Sci-Fi & Fantasy
  14: 10765,    // Fantasy -> Sci-Fi & Fantasy
  10752: 10768, // War -> War & Politics
};

function mapGenresToTV(movieGenreIds: number[]): number[] {
  return movieGenreIds
    .map((id) => GENRE_MAP_MOVIE_TO_TV[id] || (
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
    setResults([]); 
    setExplanation(null);
    setError(null);

    try {
      if (!geminiKeys || geminiKeys.length === 0) {
        await performBasicSearch(trimmed);
        return;
      }

      // Pass Array of Keys
      const analysis = await analyzeQuery(trimmed, geminiKeys);
      const normalizedMediaType = normalizeMediaType((analysis as any).media_type);
      
      const topMatch = trimmed.match(/top\s+(\d+)/i);
      let targetLimit = analysis.limit || (topMatch ? parseInt(topMatch[1], 10) : 20);
      targetLimit = Math.min(Math.max(targetLimit, 1), 50);

      if (analysis.searchType === 'trending') {
        let items = [...trendingMovies, ...trendingTv];
        if (items.length === 0) items = await tmdb.getTrending(tmdbKey);
        setResults(items.slice(0, targetLimit));
        setExplanation(analysis.explanation || 'Trending content.');
        setIsSearching(false);
        return;
      }

      let finalGenres = analysis.genres || [];
      let validFilterSearch = true;

      // Horror TV Fix
      if (normalizedMediaType === 'tv' && finalGenres.length > 0) {
        const originalCount = finalGenres.length;
        finalGenres = mapGenresToTV(finalGenres);
        if (finalGenres.length === 0 && originalCount > 0) {
            console.log("Genres invalid for TV. Switching to text search.");
            validFilterSearch = false; 
        }
      }

      let fetchedResults: MediaItem[] = [];
      const hasFilters = finalGenres.length > 0 || analysis.year || analysis.with_people || analysis.sort_by;

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

      if (fetchedResults.length === 0) {
        console.log("Using text search fallback.");
        const queryText = analysis.query || trimmed;
        fetchedResults = await tmdb.searchMulti(tmdbKey, queryText);
      }

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
