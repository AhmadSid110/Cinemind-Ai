// src/hooks/useMediaSearch.ts
import { useState, useEffect } from 'react';
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
 * Hook for media search functionality.
 * Handles search query, autocomplete, AI analysis, and result fetching.
 */
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
        console.error('Autocomplete error:', e);
      } finally {
        setIsSuggestLoading(false);
      }
    }, 300);

    return () => clearTimeout(handle);
  }, [searchQuery, tmdbKey]);

  // ---------- MEDIA TYPE NORMALIZATION ----------
  const inferMediaTypeFromText = (q: string): 'movie' | 'tv' | undefined => {
    const text = q.toLowerCase();
    if (/\b(series|tv show|tv shows|shows|web series)\b/.test(text)) {
      return 'tv';
    }
    if (/\b(movie|movies|film|films)\b/.test(text)) {
      return 'movie';
    }
    return undefined;
  };

  const normalizeMediaType = (raw: any, q: string): 'movie' | 'tv' | undefined => {
    // 1. Prefer explicit cues from user text
    const fromText = inferMediaTypeFromText(q);
    if (fromText) return fromText;

    // 2. Normalize whatever the model returned
    if (raw === 'movie' || raw === 'film' || raw === 'movies') return 'movie';
    if (
      raw === 'tv' ||
      raw === 'series' ||
      raw === 'show' ||
      raw === 'shows' ||
      raw === 'tv_show'
    ) {
      return 'tv';
    }

    return undefined;
  };

  // ---------- SEARCH FUNCTION ----------
  const search = async () => {
    if (!searchQuery.trim() || !tmdbKey) return;

    if (!geminiKey && !openaiKey) {
      setError('Please add your Gemini or OpenAI API Key in settings to use AI Search.');
      return;
    }

    setIsSearching(true);
    setError(null);
    setExplanation(null);
    setSuggestions([]); // hide autocomplete on submit

    try {
      // detect "top N" from raw query (for limits)
      const topMatch = searchQuery.match(/top\s+(\d+)/i);
      const requestedLimit = topMatch ? parseInt(topMatch[1], 10) : undefined;

      // --- AI analysis (OpenAI first, then Gemini) ---
      let analysis: GeminiFilter;
      if (openaiKey) {
        analysis = await analyzeQueryWithOpenAI(searchQuery, openaiKey);
      } else {
        analysis = await analyzeQuery(searchQuery, geminiKey);
      }

      // --- Normalize media_type so "series"/"show" becomes "tv" ---
      const normalizedMediaType = normalizeMediaType(
        (analysis as any).media_type,
        searchQuery
      );

      // Make a mutable copy so we can safely tweak genres, etc.
      const normalized: GeminiFilter = {
        ...analysis,
        media_type: normalizedMediaType,
      };

      let searchResults: MediaItem[] = [];
      let explanationText =
        normalized.explanation || 'Results based on your search.';

      let targetLimit = normalized.limit || requestedLimit || 20;
      if (!targetLimit || Number.isNaN(targetLimit) || targetLimit <= 0) {
        targetLimit = 20;
      }
      targetLimit = Math.min(targetLimit, 100); // safety cap

      // ---------- Handle search types ----------
      if (normalized.searchType === 'trending') {
        // reuse our trending movies + tv if already loaded
        if (trendingMovies.length || trendingTv.length) {
          searchResults = [...trendingMovies, ...trendingTv].slice(0, targetLimit);
        } else {
          const combined = await tmdb.getTrending(tmdbKey);
          searchResults = combined.slice(0, targetLimit);
        }
      } else if (
        normalized.searchType === 'episode_ranking' &&
        normalized.query
      ) {
        // ------- EPISODE RANKING FLOW -------
        explanationText = `Finding top ranked episodes for "${normalized.query}"...`;
        setExplanation(explanationText);

        const showId = await tmdb.findIdByName(
          tmdbKey,
          'tv',
          normalized.query
        );
        if (!showId) throw new Error('Could not find that TV show.');

        const seasons = await tmdb.getShowSeasons(tmdbKey, showId);

        const fetchPromises = seasons
          .filter((s) => s.season_number > 0)
          .slice(0, 15)
          .map((s) =>
            tmdb.getSeasonEpisodes(tmdbKey, showId, s.season_number)
          );

        const seasonsEpisodes = await Promise.all(fetchPromises);
        const allEpisodes: Episode[] = seasonsEpisodes.flat();

        const sorted = allEpisodes.sort(
          (a, b) => b.vote_average - a.vote_average
        );

        searchResults = sorted.slice(0, targetLimit).map((ep) => ({
          id: ep.id,
          name: ep.name,
          poster_path: null,
          still_path: ep.still_path,
          backdrop_path: ep.still_path,
          overview: ep.overview,
          vote_average: ep.vote_average,
          air_date: ep.air_date,
          media_type: 'tv',
          season_number: ep.season_number,
          episode_number: ep.episode_number,
        })) as any;

        explanationText = `Top ${searchResults.length} highest-rated episodes of ${normalized.query}.`;
      } else {
        // ------- GENERAL MOVIE / TV / TITLE SEARCH -------
        let personId = null;
        if (normalized.with_people) {
          personId = await tmdb.getPersonId(tmdbKey, normalized.with_people);
        }

        // --- Base discover params ---
        const params: any = {
          sort_by: normalized.sort_by || 'popularity.desc',
        };

        // --- Genres handling (including horror-series fix) ---
        if (normalized.genres && normalized.genres.length > 0) {
          let genreIds = [...normalized.genres];

          // SPECIAL CASE: "horror series" → horror TV rarely uses genre 27.
          // Map horror (27) to Sci-Fi & Fantasy (10765) + Mystery (9648)
          if (normalizedMediaType === 'tv' && genreIds.includes(27)) {
            genreIds = genreIds.filter((g) => g !== 27).concat([10765, 9648]);
            // de-duplicate
            genreIds = Array.from(new Set(genreIds));
          }

          params.with_genres = genreIds.join(',');
        }

        // --- Year handling (different keys for movie vs TV) ---
        if (normalized.year) {
          if (normalizedMediaType === 'movie') {
            params.primary_release_year = normalized.year;
          } else if (normalizedMediaType === 'tv') {
            params.first_air_date_year = normalized.year;
          } else {
            // if media type unknown, set both (harmless)
            params.primary_release_year = normalized.year;
            params.first_air_date_year = normalized.year;
          }
        }

        if (personId) {
          params.with_people = personId;
        }

        if (normalized.language) {
          params.with_original_language = normalized.language;
        }

        // If user asked "top N" or sort_by is rating -> enforce min votes
        if (
          /top\s+\d+/i.test(searchQuery) ||
          (normalized.sort_by &&
            normalized.sort_by.startsWith('vote_average'))
        ) {
          params['vote_count.gte'] = normalized.minVotes || 300;
        }

        // --- Discover vs plain keyword search ---
        if (normalizedMediaType) {
          // discover for a specific type (movie or tv)
          const page1 = await tmdb.discoverMedia(
            tmdbKey,
            normalizedMediaType,
            params
          );
          searchResults = page1;
        } else {
          // Plain title / generic search – trust the user's text more
          const queryText = (normalized.query || searchQuery).trim();
          const multi = await tmdb.searchMulti(tmdbKey, queryText);
          searchResults = multi;
        }

        // sort by rating locally if requested
        if (
          normalized.sort_by &&
          normalized.sort_by.startsWith('vote_average')
        ) {
          searchResults = [...searchResults].sort(
            (a, b) => (b.vote_average || 0) - (a.vote_average || 0)
          );
        }

        if (searchResults.length > targetLimit) {
          searchResults = searchResults.slice(0, targetLimit);
        }
      }

      setResults(searchResults);
      setExplanation(explanationText);
    } catch (e) {
      console.error(e);
      setError(
        'Sorry, I had trouble finding that. Try a simpler search or check your keys.'
      );
    } finally {
      setIsSearching(false);
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