// src/hooks/useMediaSearch.ts
import { useState, useEffect, useRef } from 'react';
import { MediaItem, Episode, GeminiFilter } from '../types';
import * as tmdb from '../services/tmdbService';
import { analyzeQuery } from '../services/geminiService';
import { analyzeQueryWithOpenAI } from '../services/openaiService';

interface UseMediaSearchProps {
  tmdbKey: string;
  geminiKey: string;
  openaiKey: string;
  trendingMovies: MediaItem[];
  trendingTv: MediaItem[];
}

/**
 * Normalize AI media_type into TMDB-compatible values.
 */
function normalizeMediaType(raw?: string | null): 'movie' | 'tv' | undefined {
  if (!raw) return undefined;
  const mt = raw.toLowerCase().trim();
  if (['movie', 'movies', 'film', 'films'].includes(mt)) return 'movie';
  if (['tv', 'tv_show', 'tv_shows', 'series', 'show', 'shows'].includes(mt)) return 'tv';
  return undefined;
}

export function useMediaSearch({
  tmdbKey,
  geminiKey,
  openaiKey,
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

  // Ref to cancel outdated requests if user types fast (optional optimization)
  const abortControllerRef = useRef<AbortController | null>(null);

  // ---------- AUTOCOMPLETE EFFECT ----------
  useEffect(() => {
    const q = searchQuery.trim();
    if (!tmdbKey || !q) {
      setSuggestions([]);
      return;
    }

    const handle = setTimeout(async () => {
      try {
        setIsSuggestLoading(true);
        const sug = await tmdb.getAutocompleteSuggestions(tmdbKey, q, 8);
        setSuggestions(sug);
      } catch (e) {
        console.warn('Autocomplete error (non-fatal):', e);
      } finally {
        setIsSuggestLoading(false);
      }
    }, 300);

    return () => clearTimeout(handle);
  }, [searchQuery, tmdbKey]);

  // ---------- CORE SEARCH LOGIC ----------
  const search = async () => {
    const trimmed = searchQuery.trim();
    if (!trimmed || !tmdbKey) return;

    // Reset State
    setIsSearching(true);
    setError(null);
    setExplanation(null);
    setSuggestions([]);
    
    // Check for Keys
    const hasAI = !!(geminiKey || openaiKey);

    try {
      // 1. SIMPLE SEARCH (No AI Key) or Fallback Trigger
      if (!hasAI) {
        console.log('[Search] No AI key, using basic search.');
        await performBasicSearch(trimmed);
        return;
      }

      // 2. AI POWERED SEARCH
      await performIntelligentSearch(trimmed);

    } catch (e) {
      console.error('[Search] Critical failure:', e);
      setError('Something went wrong. Please check your connection.');
    } finally {
      setIsSearching(false);
    }
  };

  /**
   * Strategy A: AI Analysis + Filtered Discovery
   */
  const performIntelligentSearch = async (query: string) => {
    try {
      // Step 1: Analyze Intent
      let analysis: GeminiFilter;
      
      // Try OpenAI first (if available), then Gemini
      if (openaiKey) {
        analysis = await analyzeQueryWithOpenAI(query, openaiKey);
      } else {
        analysis = await analyzeQuery(query, geminiKey);
      }

      console.log('[Search] AI Analysis:', analysis);

      // Detect "Top N" requests
      const topMatch = query.match(/top\s+(\d+)/i);
      const requestedLimit = topMatch ? parseInt(topMatch[1], 10) : undefined;
      let targetLimit = analysis.limit || requestedLimit || 20;
      targetLimit = Math.min(Math.max(targetLimit, 1), 100); // Clamp 1-100

      const normalizedMediaType = normalizeMediaType((analysis as any).media_type);

      // --- BRANCH 1: TRENDING ---
      if (analysis.searchType === 'trending') {
        let items = [...trendingMovies, ...trendingTv];
        if (items.length === 0) {
          items = await tmdb.getTrending(tmdbKey);
        }
        setResults(items.slice(0, targetLimit));
        setExplanation(analysis.explanation || 'Trending content right now.');
        return;
      }

      // --- BRANCH 2: EPISODE RANKING ---
      if (analysis.searchType === 'episode_ranking' && analysis.query) {
        setExplanation(`Ranking best episodes for "${analysis.query}"...`);
        const showId = await tmdb.findIdByName(tmdbKey, 'tv', analysis.query);
        
        if (!showId) {
          // Soft failure: Fallback to basic search for the show name
          console.warn('[Search] Show not found for ranking, falling back.');
          await performBasicSearch(analysis.query);
          return;
        }

        const seasons = await tmdb.getShowSeasons(tmdbKey, showId);
        // Limit to first 15 seasons to prevent API timeout
        const fetchPromises = seasons
          .filter((s) => s.season_number > 0)
          .slice(0, 15)
          .map((s) => tmdb.getSeasonEpisodes(tmdbKey, showId, s.season_number));

        const seasonsEpisodes = await Promise.all(fetchPromises);
        const allEpisodes: Episode[] = seasonsEpisodes.flat();
        
        // Sort by Rating High -> Low
        const sorted = allEpisodes.sort((a, b) => b.vote_average - a.vote_average);
        
        // Transform to MediaItem shape
        const finalResults = sorted.slice(0, targetLimit).map((ep) => ({
          id: ep.id,
          title: ep.name, // normalizing 'name' to 'title' for card
          name: ep.name,
          poster_path: null,
          still_path: ep.still_path,
          backdrop_path: ep.still_path,
          overview: ep.overview,
          vote_average: ep.vote_average,
          release_date: ep.air_date,
          media_type: 'tv',
          season_number: ep.season_number,
          episode_number: ep.episode_number,
        })) as any;

        setResults(finalResults);
        setExplanation(`Top ${finalResults.length} highest-rated episodes.`);
        return;
      }

      // --- BRANCH 3: SMART FILTERING (The main logic) ---
      let personId = null;
      if (analysis.with_people) {
        personId = await tmdb.getPersonId(tmdbKey, analysis.with_people);
      }

      const params: any = {
        sort_by: analysis.sort_by || 'popularity.desc',
        'vote_count.gte': analysis.minVotes || (analysis.sort_by?.includes('vote') ? 200 : 0),
        with_genres: analysis.genres?.join(','),
        primary_release_year: analysis.year,
        first_air_date_year: analysis.year,
        with_people: personId,
        with_original_language: analysis.language,
      };

      let fetchedResults: MediaItem[] = [];

      // If we have specific filters (genre, year, person), use Discover
      const hasFilters = analysis.genres || analysis.year || personId || analysis.sort_by;

      if (hasFilters && normalizedMediaType) {
         fetchedResults = await tmdb.discoverMedia(tmdbKey, normalizedMediaType, params);
      } 
      // If query is generic but AI extracted a clean title, search that
      else if (analysis.query) {
         fetchedResults = await tmdb.searchMulti(tmdbKey, analysis.query);
      }
      // If all else fails, simple search
      else {
         fetchedResults = await tmdb.searchMulti(tmdbKey, query);
      }

      // --- ZERO RESULT RESCUE ---
      // If strict AI filters found nothing, fall back to basic text search
      if (fetchedResults.length === 0) {
        console.log('[Search] Strict filters returned 0. Rescuing with basic search...');
        await performBasicSearch(query);
        setExplanation('Specific filters returned no matches, so I searched for the title instead.');
        return;
      }

      // Local sorting if needed (TMDB API sorting is sometimes limited)
      if (analysis.sort_by === 'vote_average.desc') {
        fetchedResults.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
      }

      setResults(fetchedResults.slice(0, targetLimit));
      setExplanation(analysis.explanation || 'Here is what I found.');

    } catch (aiError) {
      console.warn('[Search] AI failed, falling back to basic search:', aiError);
      // Graceful degradation: The user never sees a crash, just standard results
      await performBasicSearch(query);
      setExplanation('AI service busy. Switching to standard search.');
    }
  };

  /**
   * Strategy B: "Dumb" Search (Reliable Fallback)
   */
  const performBasicSearch = async (query: string) => {
    try {
      const basicResults = await tmdb.searchMulti(tmdbKey, query);
      setResults(basicResults);
    } catch (e) {
      throw e; // If even this fails, let the main catch block handle it
    }
  };

  const selectSuggestion = (item: MediaItem) => {
    const title = item.title || item.name || '';
    setSearchQuery(title);
    setResults([item]);
    setExplanation(null);
    setSuggestions([]);
  };

  return {
    searchQuery,
    setSearchQuery,
    results,
    explanation,
    suggestions,
    isSearching,
    isSuggestLoading,
    error,
    search,
    selectSuggestion,
  };
}
