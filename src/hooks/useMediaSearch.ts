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

  const clearSuggestions = () => {
    setSuggestions([]);
  };

  // ---------- SEARCH FUNCTION ----------
  const search = async () => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery || !tmdbKey) return;

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
      const topMatch = trimmedQuery.match(/top\s+(\d+)/i);
      const requestedLimit = topMatch ? parseInt(topMatch[1], 10) : undefined;

      // AI analysis (OpenAI first, then Gemini)
      let analysis: GeminiFilter;
      if (openaiKey) {
        analysis = await analyzeQueryWithOpenAI(trimmedQuery, openaiKey);
      } else {
        analysis = await analyzeQuery(trimmedQuery, geminiKey);
      }

      const lowerQuery = trimmedQuery.toLowerCase();

      // ---- NORMALISE media_type for TMDB ----
      let mediaType: 'movie' | 'tv' | undefined;
      if (analysis.media_type) {
        const raw = String(analysis.media_type).toLowerCase();
        if (['movie', 'movies', 'film', 'films'].includes(raw)) {
          mediaType = 'movie';
        } else if (
          ['tv', 'tv_show', 'tv_series', 'series', 'show', 'shows'].includes(
            raw
          )
        ) {
          mediaType = 'tv';
        }
      }

      // If AI didn't set it, infer from query text
      if (!mediaType) {
        if (/(series|tv show|tv series|shows)/.test(lowerQuery)) {
          mediaType = 'tv';
        } else if (/(movie|movies|film|films)/.test(lowerQuery)) {
          mediaType = 'movie';
        }
      }

      // ---- NORMALISE sort_by for "top/best" queries ----
      let sortBy = analysis.sort_by;
      if (!sortBy && /(top|best)/.test(lowerQuery)) {
        sortBy = 'vote_average.desc';
      }

      // Reasonable default for min votes if sorting by rating
      const minVotes =
        analysis.minVotes ??
        (sortBy && sortBy.startsWith('vote_average') ? 300 : undefined);

      let searchResults: MediaItem[] = [];
      let explanationText =
        analysis.explanation || 'Results based on your search.';

      let targetLimit = analysis.limit || requestedLimit || 20;
      if (!targetLimit || Number.isNaN(targetLimit) || targetLimit <= 0) {
        targetLimit = 20;
      }
      targetLimit = Math.min(targetLimit, 100); // safety cap

      // ---------- SEARCH MODES ----------
      if (analysis.searchType === 'trending') {
        // reuse our trending movies + tv if already loaded
        if (trendingMovies.length || trendingTv.length) {
          searchResults = [...trendingMovies, ...trendingTv].slice(
            0,
            targetLimit
          );
        } else {
          const combined = await tmdb.getTrending(tmdbKey);
          searchResults = combined.slice(0, targetLimit);
        }
      } else if (analysis.searchType === 'episode_ranking' && analysis.query) {
        // ----- EPISODE RANKING MODE -----
        explanationText = `Finding top ranked episodes for "${analysis.query}"...`;
        setExplanation(explanationText);

        const showId = await tmdb.findIdByName(tmdbKey, 'tv', analysis.query);
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

        explanationText = `Top ${searchResults.length} highest-rated episodes of ${analysis.query}.`;
      } else {
        // ----- GENERAL "TOP X ..." OR PLAIN TITLE MODE -----
        let personId = null;
        if (analysis.with_people) {
          personId = await tmdb.getPersonId(tmdbKey, analysis.with_people);
        }

        const params: any = {
          sort_by: sortBy || 'popularity.desc',
          ...(analysis.genres && {
            with_genres: analysis.genres.join(','),
          }),
          ...(analysis.year && {
            primary_release_year: analysis.year,
            first_air_date_year: analysis.year,
          }),
          ...(personId && { with_people: personId }),
          ...(analysis.language && {
            with_original_language: analysis.language,
          }),
        };

        // If user asked "top N" or sort_by is rating -> enforce min votes
        if (
          /top\s+\d+/i.test(trimmedQuery) ||
          (sortBy && sortBy.startsWith('vote_average'))
        ) {
          params['vote_count.gte'] = minVotes || 300;
        }

        if (mediaType) {
          // discover for a specific type (movies or series)
          const page1 = await tmdb.discoverMedia(tmdbKey, mediaType, params);
          searchResults = page1;
        } else {
          // Plain title / generic search – trust the user's text more
          const queryText = (analysis.query || trimmedQuery).trim();
          const multi = await tmdb.searchMulti(tmdbKey, queryText);
          searchResults = multi;
        }

        // sort by rating locally if requested
        if (sortBy && sortBy.startsWith('vote_average')) {
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
      // Fallback: basic TMDB search so user still gets something
      try {
        const fallback = await tmdb.searchMulti(tmdbKey, searchQuery.trim());
        if (fallback.length > 0) {
          setResults(fallback);
          setExplanation(
            `Showing basic search results for "${searchQuery}" because AI search failed.`
          );
        } else {
          setError(
            'Sorry, I had trouble finding that. Try a simpler search or check your keys.'
          );
        }
      } catch (inner) {
        console.error('Fallback search error:', inner);
        setError(
          'Sorry, I had trouble finding that. Try a simpler search or check your keys.'
        );
      }
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
    clearSuggestions,
  };
}