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
    const raw = searchQuery.trim();
    if (!raw || !tmdbKey) return;

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
      const topMatch = raw.match(/top\s+(\d+)/i);
      const requestedLimit = topMatch ? parseInt(topMatch[1], 10) : undefined;

      // AI analysis (OpenAI first, then Gemini)
      let analysis: GeminiFilter;
      if (openaiKey) {
        analysis = await analyzeQueryWithOpenAI(raw, openaiKey);
      } else {
        analysis = await analyzeQuery(raw, geminiKey);
      }

      let searchResults: MediaItem[] = [];
      let explanationText =
        analysis.explanation || 'Results based on your search.';

      let targetLimit = analysis.limit || requestedLimit || 20;
      if (!targetLimit || Number.isNaN(targetLimit) || targetLimit <= 0) {
        targetLimit = 20;
      }
      targetLimit = Math.min(targetLimit, 100); // safety cap

      // ---------- Helpers for behavior decisions ----------
      const hasTopKeyword =
        /top\s+\d+/i.test(raw) ||
        /\b(best|top rated|highest rated|highly rated)\b/i.test(raw);

      const wordCount = raw.split(/\s+/).length;
      const isShort = wordCount <= 4; // e.g. "Rick and Morty", "Breaking Bad"

      const hasFilterSignals = Boolean(
        (analysis.genres && analysis.genres.length) ||
          analysis.with_people ||
          analysis.year ||
          analysis.language ||
          analysis.sort_by ||
          analysis.media_type
      );

      const isPlainTitleSearch =
        !analysis.searchType ||
        analysis.searchType === 'title' ||
        (!hasTopKeyword && isShort && !hasFilterSignals);

      // Normalize media_type so "series" works like "tv"
      let mediaType = analysis.media_type as any;
      if (mediaType) {
        const mt = String(mediaType).toLowerCase();
        if (mt === 'series' || mt === 'tv_show' || mt === 'show') {
          mediaType = 'tv';
        } else if (mt === 'film') {
          mediaType = 'movie';
        }
      }

      // ---------- Branches ----------
      if (analysis.searchType === 'trending') {
        // reuse our trending movies + tv if already loaded
        if (trendingMovies.length || trendingTv.length) {
          searchResults = [...trendingMovies, ...trendingTv].slice(0, targetLimit);
        } else {
          const combined = await tmdb.getTrending(tmdbKey);
          searchResults = combined.slice(0, targetLimit);
        }
      } else if (analysis.searchType === 'episode_ranking' && analysis.query) {
        // EPISODE RANKING FLOW
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
      } else if (isPlainTitleSearch) {
        // ---------- PLAIN TITLE SEARCH ----------
        // For things like "Rick and Morty", "The Badlands", "Breaking Bad"
        const plainQuery = raw;
        const multi = await tmdb.searchMulti(tmdbKey, plainQuery);
        searchResults = multi.slice(0, targetLimit);
        explanationText = `Results matching "${plainQuery}".`;
      } else {
        // ---------- GENERAL DISCOVER / TOP N FLOW ----------
        let personId = null;
        if (analysis.with_people) {
          personId = await tmdb.getPersonId(tmdbKey, analysis.with_people);
        }

        const params: any = {
          sort_by: analysis.sort_by || 'popularity.desc',
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
          /top\s+\d+/i.test(raw) ||
          (analysis.sort_by && analysis.sort_by.startsWith('vote_average'))
        ) {
          // this is TMDB discover filter: minimum vote count
          params['vote_count.gte'] = analysis.minVotes || 300;
        }

        if (mediaType === 'movie' || mediaType === 'tv') {
          // discover for a specific type (movies or series)
          const page1 = await tmdb.discoverMedia(
            tmdbKey,
            mediaType,
            params
          );
          searchResults = page1;
        } else {
          // generic multi search as a fallback
          const queryText = (analysis.query || raw).trim();
          const multi = await tmdb.searchMulti(tmdbKey, queryText);
          searchResults = multi;
        }

        // sort by rating locally if requested
        if (
          analysis.sort_by &&
          analysis.sort_by.startsWith('vote_average')
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
    clearSuggestions,
  };
}