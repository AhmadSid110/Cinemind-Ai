// src/App.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Home,
  Library,
  Settings,
  Sparkles,
  Loader2,
  Video,
  Heart,
  List,
  Film,
  Tv,
  PlayCircle,
  LogIn,
  LogOut,
  UserCircle,
  Star,
} from 'lucide-react';

import { MediaItem, AppState } from './types';
import * as tmdb from './services/tmdbService';
import MediaCard from './components/MediaCard';
import DetailView from './components/DetailView';
import PersonView from './components/PersonView';
import EpisodeDetailView from './components/EpisodeDetailView';
import SettingsModal from './components/SettingsModal';
import HorizontalCarousel from './components/HorizontalCarousel';

// Hooks
import { useAuth } from './hooks/useAuth';
import { useCloudSync } from './hooks/useCloudSync';
import { useApiKeys } from './hooks/useApiKeys';
import { useLibrary } from './hooks/useLibrary';
import { useHomeFeed } from './hooks/useHomeFeed';
import { useMediaSearch } from './hooks/useMediaSearch';
import { useRatingsCache } from './hooks/useRatingsCache';

const App: React.FC = () => {
  // ---------- AUTH / KEYS ----------
  const { user, login, logout } = useAuth();
  const {
    tmdbKey,
    geminiKey,
    openaiKey,
    omdbKey,
    useOmdbRatings,
    showEpisodeImdbOnCards,
    showEpisodeImdbOnSeasonList,
    saveKeys,
    updateKeysFromCloud,
  } = useApiKeys(user);

  // ---------- APP STATE ----------
  const [state, setState] = useState<AppState>({
    view: 'trending',
    selectedItem: null,
    selectedPerson: null,
    selectedEpisode: null,
    isLoading: false,
    error: null,
    favorites: JSON.parse(localStorage.getItem('favorites') || '[]'),
    watchlist: JSON.parse(localStorage.getItem('watchlist') || '[]'),
    aiExplanation: null,
    userRatings: JSON.parse(localStorage.getItem('userRatings') || '{}'),
  });

  // ---------- SEARCH SUGGESTIONS UI ----------
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchWrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (!searchWrapperRef.current) return;
      const target = event.target as Node | null;
      if (!target) return;
      if (!searchWrapperRef.current.contains(target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // ---------- HOOKS ----------
  const { syncing: isSyncingCloud } = useCloudSync({
    user,
    state,
    setState,
    tmdbKey,
    geminiKey,
    openaiKey,
    omdbKey,
    useOmdbRatings,
    showEpisodeImdbOnCards,
    showEpisodeImdbOnSeasonList,
    updateKeysFromCloud,
  });

  const { toggleFavorite, toggleWatchlist, rateItem } = useLibrary({
    favorites: state.favorites,
    watchlist: state.watchlist,
    userRatings: state.userRatings,
    setState,
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(!tmdbKey);
  const [libraryTab, setLibraryTab] =
    useState<'favorites' | 'watchlist'>('favorites');
  const [libraryFilter, setLibraryFilter] =
    useState<'all' | 'movie' | 'tv' | 'animation'>('all');

  // ---------- HOME FEED ----------
  const {
    trendingMovies,
    trendingTv,
    inTheaters: nowPlayingMovies,
    streamingNow: onAirTv,
  } = useHomeFeed(tmdbKey);

  // ---------- RATINGS CACHE (OMDb) ----------
  const ratingsCache = useRatingsCache({
    tmdbApiKey: tmdbKey,
    omdbApiKey: useOmdbRatings ? omdbKey : '',
    ttlMs: 1000 * 60 * 60 * 24, // 24 hours
  });

  // Fetch OMDb ratings for home feed (if enabled)
  useEffect(() => {
    if (!tmdbKey) return;
    if (!useOmdbRatings) return;
    if (!omdbKey) return;

    const allItems = [
      ...trendingMovies,
      ...trendingTv,
      ...nowPlayingMovies,
      ...onAirTv,
    ].filter(
      (it) => it && (it.media_type === 'movie' || it.media_type === 'tv')
    );

    if (allItems.length > 0) {
      ratingsCache.ensureForList(allItems, 20);
    }
  }, [trendingMovies, trendingTv, nowPlayingMovies, onAirTv, tmdbKey, omdbKey, useOmdbRatings, ratingsCache]);

  // ---------- MEDIA SEARCH ----------
  const {
    searchQuery,
    setSearchQuery,
    results: searchResults,
    explanation: searchExplanation,
    suggestions,
    isSearching,
    isSuggestLoading,
    error: searchError,
    search,
    selectSuggestion,
  } = useMediaSearch({
    tmdbKey,
    geminiKey,
    openaiKey,
    trendingMovies,
    trendingTv,
  });

  // Fetch OMDb ratings for search results (if enabled)
  useEffect(() => {
    if (!tmdbKey) return;
    if (!useOmdbRatings) return;
    if (!omdbKey) return;
    if (!searchResults || searchResults.length === 0) return;

    const items = searchResults.filter(
      (it) => it && (it.media_type === 'movie' || it.media_type === 'tv')
    );

    if (items.length > 0) {
      ratingsCache.ensureForList(items, 20);
    }
  }, [searchResults, tmdbKey, omdbKey, useOmdbRatings, ratingsCache]);

  // Add state to store showId -> imdbId mapping
  const [showImdbMap, setShowImdbMap] = useState<Record<number, string | null>>({});

  // utility: fetch and populate imdb for a single show id (returns imdbId or null)
  async function fetchShowImdb(showId: number) {
    try {
      const details = await tmdb.getDetails(tmdbKey, 'tv', showId);
      const imdb = (details as any)?.external_ids?.imdb_id ?? null;
      return imdb;
    } catch (err) {
      console.warn('fetchShowImdb failed for', showId, err);
      return null;
    }
  }

  // Prefetch show imdb ids for episodes in search results and queue episode OMDb refreshes
  useEffect(() => {
    if (!tmdbKey) return;
    if (!searchResults || searchResults.length === 0) return;
    if (!ratingsCache) return; // ratings cache needed for background refresh

    // collect unique showIds that appear in searchResults' episode items
    const showIdsToFetch = new Set<number>();
    searchResults.forEach((it) => {
      const isEpisode = !!(it as any).episode_number;
      if (!isEpisode) return;
      // prefer existing show_id or tv_id injected by whatever produced the result
      const showId = (it as any).show_id ?? (it as any).tv_id ?? null;
      if (showId && !(showId in showImdbMap)) {
        showIdsToFetch.add(showId);
      }
    });

    if (showIdsToFetch.size === 0) return;

    // Limit concurrency to avoid spikes (3 at a time)
    const ids = Array.from(showIdsToFetch);
    let cancelled = false;

    (async () => {
      const concurrency = 3;
      let i = 0;
      // simple worker pool
      const workers: Promise<void>[] = [];
      const startWorker = async () => {
        while (!cancelled && i < ids.length) {
          const id = ids[i++];
          try {
            const imdb = await fetchShowImdb(id);
            if (cancelled) return;
            setShowImdbMap((prev) => {
              // don't overwrite an existing mapping
              if (prev[id] !== undefined) return prev;
              return { ...prev, [id]: imdb };
            });

            // if we found imdb and ratingsCache supports episode refresh, enqueue episode-level refresh for episodes that match this show
            if (imdb && typeof ratingsCache.refreshEpisode === 'function') {
              // find all episode entries in searchResults that belong to this show id
              searchResults.forEach((it) => {
                const isEpisode = !!(it as any).episode_number;
                const sid = (it as any).show_id ?? (it as any).tv_id ?? null;
                if (isEpisode && sid === id) {
                  const season = (it as any).season_number;
                  const episodeNum = (it as any).episode_number;
                  // background refresh; don't await, errors are logged in refreshEpisode
                  ratingsCache.refreshEpisode(imdb, season, episodeNum, false).catch(() => {});
                }
              });
            }
          } catch (e) {
            // ignore single failures
            console.warn('error fetching show imdb for id', id, e);
          }
        }
      };

      // start N workers
      for (let w = 0; w < concurrency; w++) {
        workers.push(startWorker());
      }
      await Promise.all(workers);
    })();

    return () => {
      cancelled = true;
    };
  }, [searchResults, tmdbKey, ratingsCache, showImdbMap]);

  // ---------- PERSIST LOCAL STATE ----------
  useEffect(() => {
    localStorage.setItem('favorites', JSON.stringify(state.favorites));
    localStorage.setItem('watchlist', JSON.stringify(state.watchlist));
    localStorage.setItem('userRatings', JSON.stringify(state.userRatings));
  }, [state.favorites, state.watchlist, state.userRatings]);

  // ---------- ACTIONS ----------
  const goToHome = () => {
    setState((prev) => ({
      ...prev,
      view: 'trending',
      selectedItem: null,
      selectedPerson: null,
      selectedEpisode: null,
      aiExplanation:
        "Here's what's hot right now across movies, series, in theatres and streaming.",
      error: null,
    }));
    setShowSuggestions(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    await search();

    setState((prev) => ({
      ...prev,
      view: 'search',
      isLoading: false,
      aiExplanation: searchExplanation,
      error: searchError,
    }));

    setShowSuggestions(false);
  };

  /**
   * handleCardClick
   * - If card is an episode (from "top episodes" etc.), we fetch both episode details AND the parent show details
   * - Inject `show_name`, `show_imdb_id`, `show_tvdb_id` into episodeDetails before putting into state
   */
  const handleCardClick = async (item: MediaItem) => {
    // Episode card (from episode ranking)
    if ((item as any).season_number && (item as any).episode_number) {
      if (!tmdbKey) return;
      setState((prev) => ({ ...prev, isLoading: true }));
      try {
        const showId = (item as any).show_id || (item as any).tv_id;
        if (!showId) {
          setState((prev) => ({ ...prev, isLoading: false }));
          alert(
            `${item.name}\nSeason ${(item as any).season_number}, Episode ${
              (item as any).episode_number
            }\nRating: ${item.vote_average?.toFixed(1) || 'N/A'}`
          );
          return;
        }

        // Fetch episode details + show details in parallel
        const [episodeDetails, showDetails] = await Promise.all([
          tmdb.getEpisodeDetails(
            tmdbKey,
            showId,
            (item as any).season_number,
            (item as any).episode_number
          ),
          tmdb.getDetails(tmdbKey, 'tv', showId),
        ]);

        // Inject series-level metadata into the episode object
        (episodeDetails as any).show_name =
          showDetails.name || showDetails.title || '';
        (episodeDetails as any).show_imdb_id =
          (showDetails as any).external_ids?.imdb_id ?? null;
        (episodeDetails as any).show_tvdb_id =
          (showDetails as any).external_ids?.tvdb_id ?? null;
(episodeDetails as any).show_id = showId; // <-- ADD THIS

        setState((prev) => ({
          ...prev,
          selectedEpisode: episodeDetails,
          selectedItem: null,
          selectedPerson: null,
          isLoading: false,
        }));
      } catch (err) {
        console.error(err);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'Could not load episode details.',
        }));
      }
      return;
    }

    // Normal movie / tv click
    if (!tmdbKey) return;
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const details = await tmdb.getDetails(
        tmdbKey,
        item.media_type as 'movie' | 'tv',
        item.id
      );
      setState((prev) => ({
        ...prev,
        selectedItem: details,
        selectedEpisode: null,
        isLoading: false,
        selectedPerson: null,
      }));
    } catch (e) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Could not load details.',
      }));
    }
  };

  /**
   * handleEpisodeClick
   * - Used when clicking an episode from inside a DetailView season episodes list
   * - Makes sure to attach show-level ids to episodeDetails so EpisodeDetailView can make episode deep-link reliably
   */
  const handleEpisodeClick = async (
    showId: number,
    seasonNumber: number,
    episodeNumber: number
  ) => {
    if (!tmdbKey) return;
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      // Fetch episode details
      const episodeDetails = await tmdb.getEpisodeDetails(
        tmdbKey,
        showId,
        seasonNumber,
        episodeNumber
      );

      // If we already have the show loaded in selectedItem (DetailView open),
      // reuse its external_ids. Otherwise, fetch show detail for external ids.
      if (state.selectedItem) {
  const show: any = state.selectedItem;
  (episodeDetails as any).show_name =
    show.title || show.name || '';
  (episodeDetails as any).show_imdb_id =
    show.external_ids?.imdb_id ?? null;
  (episodeDetails as any).show_tvdb_id =
    show.external_ids?.tvdb_id ?? null;
  (episodeDetails as any).show_id = show.id ?? undefined; // <-- ADD THIS
} else {
        // Fetch show details in case not present
        const showDetails = await tmdb.getDetails(tmdbKey, 'tv', showId);
        (episodeDetails as any).show_name =
          showDetails.name || showDetails.title || '';
        (episodeDetails as any).show_imdb_id =
          (showDetails as any).external_ids?.imdb_id ?? null;
        (episodeDetails as any).show_tvdb_id =
          (showDetails as any).external_ids?.tvdb_id ?? null;
      }

      setState((prev) => ({
        ...prev,
        selectedEpisode: episodeDetails,
        isLoading: false,
      }));
    } catch (err) {
      console.error(err);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Could not load episode details.',
      }));
    }
  };

  const handleCastClick = async (personId: number) => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      selectedItem: null,
    }));
    try {
      const person = await tmdb.getPersonDetails(tmdbKey, personId);
      setState((prev) => ({
        ...prev,
        selectedPerson: person,
        isLoading: false,
      }));
    } catch (e) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Could not load person details.',
      }));
    }
  };

  // ---------- AUTH HANDLERS ----------
  const handleLogin = async () => {
    try {
      await login();
    } catch (err) {
      console.error('Login error:', err);
      alert('Google login failed. Check console for details.');
    }
  };
  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // ---------- AUTOCOMPLETE SUGGESTION CLICK ----------
  const handleSuggestionClick = (item: MediaItem) => {
    selectSuggestion(item);
    setState((prev) => ({
      ...prev,
      view: 'search',
      aiExplanation: null,
      error: null,
    }));
    setShowSuggestions(false);
  };

  // ---------- HELPERS ----------
  const renderGrid = (items: MediaItem[], showRank: boolean = false) => (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
      {items.map((originalItem, idx) => {
        // clone and augment episodes with show_imdb_id from local map if available
        const isEpisode = !!(originalItem as any).episode_number;
        let item = originalItem;
        if (isEpisode) {
          const showId = (originalItem as any).show_id ?? (originalItem as any).tv_id ?? null;
          const existingShowImdb = (originalItem as any).show_imdb_id ?? null;
          const fetchedShowImdb = showId ? showImdbMap[showId] ?? null : null;
          const showImdb = fetchedShowImdb ?? existingShowImdb;
          
          if (showImdb || showId) {
            item = {
              ...originalItem,
              show_imdb_id: showImdb,
              show_id: showId,
            } as MediaItem;
          }
        }

        return (
          <MediaCard
            key={`${item.id}-${(item as any).episode_number || 0}`}
            item={item}
            onClick={handleCardClick}
            rank={showRank ? idx + 1 : undefined}
            ratingsCache={ratingsCache}
            useOmdbRatings={useOmdbRatings}
            showEpisodeImdbOnCards={showEpisodeImdbOnCards}
          />
        );
      })}
    </div>
  );

  const getFilteredLibrary = () => {
    const list =
      libraryTab === 'favorites' ? state.favorites : state.watchlist;
    if (libraryFilter === 'all') return list;
    if (libraryFilter === 'animation')
      return list.filter((i) => i.genre_ids?.includes(16));
    return list.filter((i) => i.media_type === libraryFilter);
  };

  // ---------- RENDER ----------
  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans pb-24 selection:bg-cyan-500/30 selection:text-cyan-100">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-[#020617]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between gap-6">
          {/* Logo / Home */}
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={goToHome}
          >
            <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-2.5 rounded-xl shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition-all duration-300">
              <Video className="text-white fill-white" size={20} />
            </div>
            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 hidden md:block">
              CineMind
            </span>
          </div>

          {/* Search Bar + Autocomplete */}
          <div
            ref={searchWrapperRef}
            className="flex-1 max-w-2xl relative group"
          >
            <form onSubmit={handleSearch} className="relative">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Sparkles
                  className={`w-5 h-5 transition-colors ${
                    isSearching
                      ? 'animate-pulse text-cyan-400'
                      : 'text-slate-500 group-focus-within:text-cyan-400'
                  }`}
                />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  if (val.trim()) setShowSuggestions(true);
                  else setShowSuggestions(false);
                }}
                placeholder="Search titles or ask things like 'Top 20 sci-fi movies like Interstellar'"
                className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:bg-slate-900 focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all shadow-inner"
              />

              {isSearching && (
                <div className="absolute inset-y-0 right-4 flex items-center">
                  <Loader2 className="animate-spin text-cyan-500" size={20} />
                </div>
              )}

              {/* Autocomplete dropdown */}
              {showSuggestions &&
                suggestions.length > 0 &&
                searchQuery.trim() && (
                  <div className="absolute mt-2 left-0 right-0 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 max-h-80 overflow-y-auto">
                    {suggestions.map((sug, idx) => {
                      const title = sug.title || sug.name;
                      const date = sug.release_date || sug.first_air_date || '';
                      const year = date ? new Date(date).getFullYear() : '';
                      return (
                        <button
                          key={`${sug.id}-${idx}`}
                          type="button"
                          onClick={() => handleSuggestionClick(sug)}
                          className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-800 border-b border-slate-800/60 last:border-b-0"
                        >
                          <div className="flex flex-col items-start">
                            <span className="text-slate-100">{title}</span>
                            <span className="text-xs text-slate-500">
                              {(sug.media_type || '').toUpperCase()}{' '}
                              {year && `• ${year}`}
                            </span>
                          </div>
                          {typeof sug.vote_average === 'number' && (
                            <span className="text-xs text-amber-300 flex items-center gap-1">
                              <Star size={12} />
                              {sug.vote_average.toFixed(1)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {isSuggestLoading && (
                      <div className="px-3 py-2 text-xs text-slate-400 flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" />
                        Updating suggestions…
                      </div>
                    )}
                  </div>
                )}
            </form>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            {isSyncingCloud && user && (
              <div className="flex items-center gap-1 text-xs text-cyan-300">
                <Loader2 size={14} className="animate-spin" />
                <span>Syncing</span>
              </div>
            )}

            {user ? (
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 text-xs md:text-sm rounded-xl bg-slate-900/60 border border-white/10 hover:border-red-400/60 hover:bg-red-500/10 transition"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-6 h-6 rounded-full"
                  />
                ) : (
                  <UserCircle size={18} />
                )}
                <span className="hidden md:inline max-w-[120px] truncate">
                  {user.displayName || user.email}
                </span>
                <LogOut size={16} className="hidden md:inline" />
              </button>
            ) : (
              <button
                onClick={handleLogin}
                className="flex items-center gap-2 px-3 py-2 text-xs md:text-sm rounded-xl bg-slate-900/60 border border-white/10 hover:border-cyan-400/60 hover:bg-cyan-500/10 transition"
              >
                <LogIn size={16} />
                <span className="hidden md:inline">Sign in with Google</span>
              </button>
            )}

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-3 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition border border-transparent hover:border-white/5"
            >
              <Settings size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto px-4 py-10">
        {/* AI Explanation */}
        {state.aiExplanation && !isSearching && (
          <div className="mb-10 bg-gradient-to-r from-cyan-950/30 to-blue-950/30 border border-cyan-500/20 p-5 rounded-2xl flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <Sparkles className="text-cyan-400 shrink-0" size={20} />
            </div>
            <div>
              <h3 className="text-cyan-200 font-bold text-sm uppercase tracking-wider mb-1">
                AI Analysis
              </h3>
              <p className="text-slate-300 leading-relaxed">
                {state.aiExplanation}
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {state.error && (
          <div className="mb-8 bg-red-950/20 border border-red-500/30 p-4 rounded-2xl text-red-200 text-center flex flex-col items-center gap-2">
            <Loader2 className="animate-spin text-red-400" size={24} />
            {state.error}
          </div>
        )}

        {/* Views */}
        {state.view === 'library' ? (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 flex items-center gap-3">
                <Library className="text-cyan-500" /> My Library
              </h2>
              <div className="bg-slate-900/50 p-1.5 rounded-xl flex gap-1 border border-white/5 backdrop-blur-md">
                <button
                  onClick={() => setLibraryTab('favorites')}
                  className={`px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                    libraryTab === 'favorites'
                      ? 'bg-slate-800 text-white shadow-lg ring-1 ring-white/10'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Heart size={16} className={libraryTab === 'favorites' ? 'text-pink-500 fill-pink-500' : ''} /> Favorites
                </button>
                <button
                  onClick={() => setLibraryTab('watchlist')}
                  className={`px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                    libraryTab === 'watchlist'
                      ? 'bg-slate-800 text-white shadow-lg ring-1 ring-white/10'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <List size={16} className={libraryTab === 'watchlist' ? 'text-emerald-500' : ''} /> Watchlist
                </button>
              </div>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
              {[
                { id: 'all', label: 'All', icon: null },
                { id: 'movie', label: 'Movies', icon: Film },
                { id: 'tv', label: 'Series', icon: Tv },
                { id: 'animation', label: 'Animation', icon: PlayCircle },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setLibraryFilter(f.id as any)}
                  className={`px-5 py-2.5 rounded-full text-sm font-bold border transition-all flex items-center gap-2 whitespace-nowrap transform hover:-translate-y-0.5 ${
                    libraryFilter === f.id
                      ? 'bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-900/40'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500 hover:bg-slate-800'
                  }`}
                >
                  {f.icon && <f.icon size={16} />} {f.label}
                </button>
              ))}
            </div>

            <div className="min-h-[300px]">
              {getFilteredLibrary().length > 0 ? (
                renderGrid(getFilteredLibrary(), false)
              ) : (
                <div className="flex flex-col items-center justify-center h-80 text-slate-500 border-2 border-dashed border-slate-800/50 rounded-3xl bg-slate-900/20">
                  <Video size={48} className="mb-4 text-slate-700" />
                  <p className="text-lg font-medium">
                    No items found in {libraryTab} ({libraryFilter}).
                  </p>
                  <p className="text-sm">Go explore and add some!</p>
                </div>
              )}
            </div>
          </div>
        ) : state.view === 'trending' ? (
          <div className="space-y-10 animate-in fade-in duration-500">
            <HorizontalCarousel
              title="Trending Movies"
              items={trendingMovies}
              onItemClick={handleCardClick}
              accentColor="cyan"
              emptyMessage="No trending movies available right now."
              ratingsCache={ratingsCache}
              useOmdbRatings={useOmdbRatings}
            />

            <HorizontalCarousel
              title="Trending Series"
              items={trendingTv}
              onItemClick={handleCardClick}
              accentColor="fuchsia"
              emptyMessage="No trending series available right now."
              ratingsCache={ratingsCache}
              useOmdbRatings={useOmdbRatings}
            />

            <HorizontalCarousel
              title="In Theatres Now"
              items={nowPlayingMovies}
              onItemClick={handleCardClick}
              accentColor="emerald"
              emptyMessage='No "Now Playing" movies available for your region.'
              ratingsCache={ratingsCache}
              useOmdbRatings={useOmdbRatings}
            />

            <HorizontalCarousel
              title="Streaming Now on TV"
              items={onAirTv}
              onItemClick={handleCardClick}
              accentColor="indigo"
              emptyMessage='No "On The Air" TV data available right now.'
              ratingsCache={ratingsCache}
              useOmdbRatings={useOmdbRatings}
            />
          </div>
        ) : (
          <div className="animate-in fade-in duration-500">
            <h2 className="text-3xl font-bold text-white mb-8 capitalize flex items-center gap-3">
              <span className="w-2 h-8 bg-cyan-500 rounded-full" />
              Search Results
            </h2>
            {searchResults.length > 0 ? (
              renderGrid(searchResults, true)
            ) : (
              !isSearching && (
                <div className="flex flex-col items-center justify-center py-32 text-slate-500">
                  <Sparkles size={64} className="mb-6 text-slate-800" />
                  <p className="text-xl font-light">
                    Start by typing what you feel like watching above.
                  </p>
                </div>
              )
            )}
          </div>
        )}
      </main>

      {/* MOBILE NAV */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#020617]/90 backdrop-blur-xl border-t border-white/5 z-40 pb-safe">
        <div className="flex justify-around p-4">
          <button
            onClick={goToHome}
            className={`flex flex-col items-center gap-1.5 transition-colors ${
              state.view === 'trending' ? 'text-cyan-400' : 'text-slate-500'
            }`}
          >
            <Home size={24} strokeWidth={state.view === 'trending' ? 2.5 : 2} />
            <span className="text-[10px] font-bold uppercase tracking-wide">Home</span>
          </button>
          <button
            onClick={() => setState((prev) => ({ ...prev, view: 'library' }))}
            className={`flex flex-col items-center gap-1.5 transition-colors ${
              state.view === 'library' ? 'text-cyan-400' : 'text-slate-500'
            }`}
          >
            <Library size={24} strokeWidth={state.view === 'library' ? 2.5 : 2} />
            <span className="text-[10px] font-bold uppercase tracking-wide">My List</span>
          </button>
        </div>
      </nav>

      {/* MODALS */}
      {state.selectedItem && (
        <DetailView
          item={state.selectedItem}
          onClose={() => setState((prev) => ({ ...prev, selectedItem: null }))}
          apiKey={tmdbKey}
          onToggleFavorite={toggleFavorite}
          onToggleWatchlist={toggleWatchlist}
          isFavorite={state.favorites.some((f) => f.id === state.selectedItem?.id)}
          isWatchlist={state.watchlist.some((w) => w.id === state.selectedItem?.id)}
          onCastClick={handleCastClick}
          onEpisodeClick={handleEpisodeClick}
          userRatings={state.userRatings}
          onRate={rateItem}
          ratingsCache={ratingsCache}
          useOmdbRatings={useOmdbRatings}
          showEpisodeImdbOnSeasonList={showEpisodeImdbOnSeasonList}
        />
      )}

      {state.selectedPerson && (
        <PersonView
          person={state.selectedPerson}
          onClose={() => setState((prev) => ({ ...prev, selectedPerson: null }))}
          onMediaClick={handleCardClick}
        />
      )}

      {state.selectedEpisode && (
        <EpisodeDetailView
          episode={state.selectedEpisode}
          showTitle={(state.selectedEpisode as any).show_name}
          onClose={() => setState((prev) => ({ ...prev, selectedEpisode: null }))}
          onRate={rateItem}
          userRating={state.userRatings[String(state.selectedEpisode.id)]}
          ratingsCache={ratingsCache}
          useOmdbRatings={useOmdbRatings}
          showEpisodeImdbOnSeasonList={showEpisodeImdbOnSeasonList}
        />
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentKey={tmdbKey}
        currentGeminiKey={geminiKey}
        currentOpenAIKey={openaiKey}
        currentOmdbKey={omdbKey}
        useOmdbRatings={useOmdbRatings}
        currentShowEpisodeImdbOnCards={!!showEpisodeImdbOnCards}
        currentShowEpisodeImdbOnSeasonList={!!showEpisodeImdbOnSeasonList}
        onSave={async (key, geminiKey, openaiKey, omdbKey, useOmdb, showOnCards, showInSeason) => {
          saveKeys(key, geminiKey, openaiKey, omdbKey, useOmdb, showOnCards, showInSeason);
        }}
      />
    </div>
  );
};

export default App;