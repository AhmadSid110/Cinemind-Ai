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
  rankEpisodesByImdb?: boolean;
  ratingsCache?: any;
}

/**
 * Helper: infer clean media_type ('movie' | 'tv' | null)
 * from AI output + raw user query (handles "series", "tv show", etc.)
 */
function inferMediaType(
  aiMediaType: string | undefined,
  query: string
): 'movie' | 'tv' | null {
  const mt = (aiMediaType || '').toLowerCase();
  if (['movie', 'movies', 'film', 'films'].includes(mt)) return 'movie';
  if (['tv', 'tv_show', 'tv show', 'tv series', 'series', 'show', 'shows'].includes(mt)) return 'tv';

  const q = query.toLowerCase();
  if (/\b(movie|movies|film|films)\b/.test(q)) return 'movie';
  if (/\b(series|tv|show|shows|anime)\b/.test(q)) return 'tv';

  return null;
}

/**
 * Helper: detect "ranking-style" queries like "top 10 horror series",
 * "best rated sci fi movies", etc.
 */
function isRankingQuery(query: string, analysis?: GeminiFilter): boolean {
  const q = query.toLowerCase();
  if (/top\s+\d+/.test(q)) return true;
  if (/\b(best|greatest|highest rated|top rated)\b/.test(q)) return true;
  if (analysis?.sort_by && analysis.sort_by.startsWith('vote_average')) return true;
  return false;
}

/**
 * Hook for media search:
 * - AI analysis (Gemini / OpenAI)
 * - Episode ranking
 * - Title / discover search
 * - Autocomplete suggestions
 */
export function useMediaSearch({
  tmdbKey,
  geminiKey,
  openaiKey,
  trendingMovies,
  trendingTv,
  rankEpisodesByImdb = false,
  ratingsCache,
}: UseMediaSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<MediaItem[]>([]);
  const [explanation, setExplanation] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<MediaItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSuggestLoading, setIsSuggestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---------- AUTOCOMPLETE ----------
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

  // ---------- MAIN SEARCH ----------
  const search = async () => {
    const raw = searchQuery.trim();
    if (!raw || !tmdbKey) return;

    if (!geminiKey && !openaiKey) {
      // We *still* allow plain title search in this case
      try {
        setIsSearching(true);
        setError(null);
        setExplanation(null);
        setSuggestions([]);

        const multi = await tmdb.searchMulti(tmdbKey, raw);
        setResults(multi);
        setExplanation('Results based on your title search.');
      } catch (e) {
        console.error(e);
        setError(
          'Sorry, I had trouble finding that. Try again or add an AI key for smarter search.'
        );
      } finally {
        setIsSearching(false);
      }
      return;
    }

    setIsSearching(true);
    setError(null);
    setExplanation(null);
    setSuggestions([]);

    try {
      // --- 1) AI ANALYSIS ---
      let analysis: GeminiFilter;
      if (openaiKey) {
        analysis = await analyzeQueryWithOpenAI(raw, openaiKey);
      } else {
        analysis = await analyzeQuery(raw, geminiKey);
      }

      const normalizedSearchType = analysis.searchType || 'general';
      const targetLimitFromQuery = raw.match(/top\s+(\d+)/i);
      const requestedLimit = targetLimitFromQuery
        ? parseInt(targetLimitFromQuery[1], 10)
        : undefined;

      let targetLimit =
        analysis.limit || requestedLimit || 20;
      if (!targetLimit || Number.isNaN(targetLimit) || targetLimit <= 0) {
        targetLimit = 20;
      }
      targetLimit = Math.min(targetLimit, 100);

      let searchResults: MediaItem[] = [];
      let explanationText =
        analysis.explanation || 'Results based on your search.';

      const rankingStyle = isRankingQuery(raw, analysis);
      const mediaType = inferMediaType(analysis.media_type as any, raw);

      // --- 2) HANDLE SEARCH TYPES ---

      // A) TRENDING
      if (normalizedSearchType === 'trending') {
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

      // B) EPISODE RANKING
      else if (
        normalizedSearchType === 'episode_ranking' &&
        analysis.query
      ) {
        const title = analysis.query;
        explanationText = `Finding top ranked episodes for "${title}"...`;
        setExplanation(explanationText);

        const showId = await tmdb.findIdByName(tmdbKey, 'tv', title);
        if (!showId) throw new Error('Could not find that TV show.');

        // Fetch show details to get IMDb ID (if using IMDb ranking)
        let showImdbId: string | null = null;
        if (rankEpisodesByImdb && ratingsCache) {
          try {
            const showDetails = await tmdb.getDetails(tmdbKey, 'tv', showId);
            showImdbId = (showDetails as any)?.external_ids?.imdb_id ?? null;
          } catch (err) {
            console.warn('Failed to fetch show IMDb ID for episode ranking', err);
          }
        }

        const seasons = await tmdb.getShowSeasons(tmdbKey, showId);

        const fetchPromises = seasons
          .filter((s) => s.season_number > 0)
          .slice(0, 15)
          .map((s) =>
            tmdb.getSeasonEpisodes(tmdbKey, showId, s.season_number)
          );

        const seasonsEpisodes = await Promise.all(fetchPromises);
        const allEpisodes: Episode[] = seasonsEpisodes.flat();

        // Sort episodes based on ranking preference
        let sorted: Episode[];
        if (rankEpisodesByImdb && ratingsCache && showImdbId) {
          sorted = allEpisodes.sort((a, b) => {
            const ra = ratingsCache.getEpisodeCached(showImdbId, a.season_number, a.episode_number)?.imdbRating;
            const rb = ratingsCache.getEpisodeCached(showImdbId, b.season_number, b.episode_number)?.imdbRating;

            const ia = ra ? parseFloat(ra) : null;
            const ib = rb ? parseFloat(rb) : null;

            // If both IMDb exist → sort by IMDb
            if (ia !== null && ib !== null) return ib - ia;

            // If only IMDb exists for one → that one should be higher
            if (ia !== null && ib === null) return -1;
            if (ia === null && ib !== null) return 1;

            // Fallback: sort by TMDB
            return (b.vote_average ?? 0) - (a.vote_average ?? 0);
          });
        } else {
          // Normal TMDB ranking
          sorted = allEpisodes.sort(
            (a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0)
          );
        }

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
          show_id: showId,
        })) as any;

        explanationText = `Top ${searchResults.length} highest-rated episodes of ${title}.`;
      }

      // C) GENERAL / MIXED QUERIES
      else {
        // --------- Build Discover params (only used when needed) ----------
        const params: any = {
          sort_by: analysis.sort_by || (rankingStyle ? 'vote_average.desc' : 'popularity.desc'),
        };

        if (analysis.genres && analysis.genres.length > 0) {
          params.with_genres = analysis.genres.join(',');
        }
        if (analysis.year) {
          params.primary_release_year = analysis.year;
          params.first_air_date_year = analysis.year;
        }
        if (analysis.with_people) {
          const personId = await tmdb.getPersonId(
            tmdbKey,
            analysis.with_people
          );
          if (personId) params.with_people = personId;
        }
        if (analysis.language) {
          params.with_original_language = analysis.language;
        }

        // For ranking-style queries, enforce minimum vote count
        if (rankingStyle) {
          params['vote_count.gte'] = analysis.minVotes || 300;
        }

        const hasStructuredFilters =
          !!params.with_genres ||
          !!params.primary_release_year ||
          !!params.first_air_date_year ||
          !!params.with_people ||
          !!params.with_original_language ||
          rankingStyle;

        const queryText = (analysis.query || raw).trim();

        // CASE 1: Structured + known media type -> DISCOVER
        if (hasStructuredFilters && mediaType) {
          const discovered = await tmdb.discoverMedia(
            tmdbKey,
            mediaType,
            params
          );
          searchResults = discovered;
          // Extra sort by rating for ranking queries
          if (rankingStyle) {
            searchResults = [...searchResults].sort(
              (a, b) => (b.vote_average || 0) - (a.vote_average || 0)
            );
          }
        }

        // CASE 2: No strong structure => plain title / keyword search
        else {
          const multi = await tmdb.searchMulti(tmdbKey, queryText);
          searchResults = multi;
          // Local rating sort only if clearly ranking style
          if (rankingStyle) {
            searchResults = [...searchResults].sort(
              (a, b) => (b.vote_average || 0) - (a.vote_average || 0)
            );
          }
        }

        if (searchResults.length > targetLimit) {
          searchResults = searchResults.slice(0, targetLimit);
        }
      }

      setResults(searchResults);
      setExplanation(explanationText);
    } catch (e) {
      console.error('Search error:', e);
      setError(
        'Sorry, I had trouble understanding that. Try a simpler wording or different filters.'
      );
    } finally {
      setIsSearching(false);
    }
  };

  // ---------- SUGGESTION SELECTION ----------
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