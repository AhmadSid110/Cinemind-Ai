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
 * Handles:
 *  - plain title search (no AI)
 *  - natural language AI search (Gemini / OpenAI)
 *  - autocomplete suggestions
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

  // ---------- SEARCH FUNCTION ----------
  const search = async () => {
    const q = searchQuery.trim();
    if (!q || !tmdbKey) return;

    // Heuristic: detect "plain title" queries and bypass AI completely.
    // Plain title = does NOT contain intent words like "top", "best", "episodes", "series", etc.
    const isPlainTitle = !/\b(top|best|worst|episode|episodes|season|seasons|series|show|shows|movie|movies|film|films|list|recommend|similar|like|tv)\b/i.test(
      q
    );

    setIsSearching(true);
    setError(null);
    setExplanation(null);
    setSuggestions([]); // hide autocomplete on submit

    try {
      // ---------- PLAIN TITLE SEARCH (no AI) ----------
      if (isPlainTitle) {
        const multi = await tmdb.searchMulti(tmdbKey, q);
        setResults(multi);
        setExplanation(`Direct search results for "${q}".`);
        return;
      }

      // ---------- AI-POWERED SEARCH ----------
      if (!geminiKey && !openaiKey) {
        setError(
          'Please add your Gemini or OpenAI API Key in settings to use AI Search.'
        );
        return;
      }

      // detect "top N" from raw query (for limits)
      const topMatch = q.match(/top\s+(\d+)/i);
      const requestedLimit = topMatch ? parseInt(topMatch[1], 10) : undefined;

      // AI analysis (OpenAI first, then Gemini)
      let analysis: GeminiFilter;
      if (openaiKey) {
        analysis = await analyzeQueryWithOpenAI(q, openaiKey);
      } else {
        analysis = await analyzeQuery(q, geminiKey);
      }

      let searchResults: MediaItem[] = [];
      let explanationText =
        analysis.explanation || 'Results based on your search.';

      let targetLimit = analysis.limit || requestedLimit || 20;
      if (!targetLimit || Number.isNaN(targetLimit) || targetLimit <= 0) {
        targetLimit = 20;
      }
      targetLimit = Math.min(targetLimit, 100); // safety cap

      // ---------- SEARCH TYPE: TRENDING ----------
      if (analysis.searchType === 'trending') {
        if (trendingMovies.length || trendingTv.length) {
          searchResults = [...trendingMovies, ...trendingTv].slice(
            0,
            targetLimit
          );
        } else {
          const combined = await tmdb.getTrending(tmdbKey);
          searchResults = combined.slice(0, targetLimit);
        }
      }
      // ---------- SEARCH TYPE: EPISODE RANKING ----------
      else if (analysis.searchType === 'episode_ranking' && analysis.query) {
        explanationText = `Finding top ranked episodes for "${analysis.query}"...`;
        setExplanation(explanationText);

        const showId = await tmdb.findIdByName(
          tmdbKey,
          'tv',
          analysis.query
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

        explanationText = `Top ${searchResults.length} highest-rated episodes of ${analysis.query}.`;
      }
      // ---------- GENERAL / "TOP N ..." / GENRE QUERIES ----------
      else {
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
          /top\s+\d+/i.test(q) ||
          (analysis.sort_by && analysis.sort_by.startsWith('vote_average'))
        ) {
          params['vote_count.gte'] = analysis.minVotes || 300;
        }

        if (analysis.media_type) {
          // discover for a specific type – handles "top 10 horror series", etc.
          const page1 = await tmdb.discoverMedia(
            tmdbKey,
            analysis.media_type,
            params
          );
          searchResults = page1;
        } else {
          // Fallback: generic multi search using user's text (for weird AI outputs)
          const queryText = (analysis.query || q).trim();
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
  };
}