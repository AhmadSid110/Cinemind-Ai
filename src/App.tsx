import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';

import { MediaItem, AppState, Episode, GeminiFilter } from './types';
import * as tmdb from './services/tmdbService';
import { analyzeQuery } from './services/geminiService';
import { analyzeQueryWithOpenAI } from './services/openaiService';
import MediaCard from './components/MediaCard';
import DetailView from './components/DetailView';
import PersonView from './components/PersonView';
import SettingsModal from './components/SettingsModal';

// Firebase helpers
import {
  auth,
  loginWithGoogle,
  subscribeToAuthChanges,
  loadUserData,
  saveUserData,
} from './firebase';

const App: React.FC = () => {
  // ---------- APP STATE ----------
  const [state, setState] = useState<AppState>({
    view: 'trending',
    searchQuery: '',
    tmdbKey: localStorage.getItem('tmdb_key') || '',
    geminiKey: localStorage.getItem('gemini_key') || process.env.API_KEY || '',
    openaiKey: localStorage.getItem('openai_key') || '',
    searchResults: [],
    selectedItem: null,
    selectedPerson: null,
    isLoading: false,
    error: null,
    favorites: JSON.parse(localStorage.getItem('favorites') || '[]'),
    watchlist: JSON.parse(localStorage.getItem('watchlist') || '[]'),
    aiExplanation: null,
    userRatings: JSON.parse(localStorage.getItem('userRatings') || '{}'),
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(!state.tmdbKey);
  const [libraryTab, setLibraryTab] =
    useState<'favorites' | 'watchlist'>('favorites');
  const [libraryFilter, setLibraryFilter] =
    useState<'all' | 'movie' | 'tv' | 'animation'>('all');

  // ---------- FIREBASE USER / SYNC STATE ----------
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [hasLoadedCloud, setHasLoadedCloud] = useState(false); // initial cloud load gate
  const [isRankingView, setIsRankingView] = useState(false); // whether current search is a "ranking" style query

  // ---------- LOCAL PERSISTENCE ----------
  useEffect(() => {
    localStorage.setItem('favorites', JSON.stringify(state.favorites));
    localStorage.setItem('watchlist', JSON.stringify(state.watchlist));
    localStorage.setItem('userRatings', JSON.stringify(state.userRatings));
  }, [state.favorites, state.watchlist, state.userRatings]);

  useEffect(() => {
    if (state.tmdbKey) {
      localStorage.setItem('tmdb_key', state.tmdbKey);
    }
    if (state.geminiKey) {
      localStorage.setItem('gemini_key', state.geminiKey);
    }
    if (state.openaiKey) {
      localStorage.setItem('openai_key', state.openaiKey);
    }
  }, [state.tmdbKey, state.geminiKey, state.openaiKey]);

  // ---------- LOAD TRENDING WHEN TMDB KEY AVAILABLE ----------
  useEffect(() => {
    if (state.tmdbKey) {
      loadTrending();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tmdbKey]);

  // ---------- FIREBASE AUTH SUBSCRIPTION (CLOUD-FIRST LOAD) ----------
  useEffect(() => {
    const unsub = subscribeToAuthChanges(async (user) => {
      setCurrentUser(user);
      setHasLoadedCloud(false);

      if (!user) return;

      try {
        setIsSyncingCloud(true);
        const cloud = await loadUserData(user.uid);

        if (cloud) {
          const nextFavorites = cloud.favorites || [];
          const nextWatchlist = cloud.watchlist || [];
          const nextTmdbKey = cloud.tmdbKey || '';
          const nextGeminiKey = cloud.geminiKey || '';
          const nextOpenaiKey = cloud.openaiKey || '';
          const nextUserRatings = cloud.userRatings || {};

          setState((prev) => ({
            ...prev,
            favorites: nextFavorites,
            watchlist: nextWatchlist,
            tmdbKey: nextTmdbKey || prev.tmdbKey,
            geminiKey: nextGeminiKey || prev.geminiKey,
            openaiKey: nextOpenaiKey || prev.openaiKey,
            userRatings: nextUserRatings,
          }));

          localStorage.setItem('favorites', JSON.stringify(nextFavorites));
          localStorage.setItem('watchlist', JSON.stringify(nextWatchlist));
          localStorage.setItem('userRatings', JSON.stringify(nextUserRatings));
          if (nextTmdbKey) localStorage.setItem('tmdb_key', nextTmdbKey);
          if (nextGeminiKey) localStorage.setItem('gemini_key', nextGeminiKey);
          if (nextOpenaiKey) localStorage.setItem('openai_key', nextOpenaiKey);
        } else {
          console.log('[SYNC] No cloud doc yet, will push local as initial');
        }
      } catch (err) {
        console.error('Error loading user cloud data:', err);
      } finally {
        setIsSyncingCloud(false);
        setHasLoadedCloud(true);
      }
    });

    return () => unsub();
  }, []);

  // ---------- CONTINUOUS SYNC TO FIRESTORE ----------
  useEffect(() => {
    const sync = async () => {
      if (!currentUser) return;
      if (!hasLoadedCloud) return;

      try {
        setIsSyncingCloud(true);
        await saveUserData(currentUser.uid, {
          favorites: state.favorites,
          watchlist: state.watchlist,
          tmdbKey: state.tmdbKey,
          geminiKey: state.geminiKey,
          openaiKey: state.openaiKey,
          userRatings: state.userRatings,
        });
      } catch (err) {
        console.error('Error syncing to Firestore:', err);
      } finally {
        setIsSyncingCloud(false);
      }
    };

    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentUser,
    hasLoadedCloud,
    state.favorites,
    state.watchlist,
    state.tmdbKey,
    state.geminiKey,
    state.openaiKey,
    state.userRatings,
  ]);

  // ---------- HELPERS TO CLASSIFY QUERY ----------

  // “Rick and Morty”, “Into the Badlands” etc → direct TMDB search, no AI
  const isPlainTitleQuery = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return false;
    const words = trimmed.split(/\s+/);
    const lower = trimmed.toLowerCase();

    // Words that imply "command" style, not direct title
    const hasControlWords = /\b(top|best|rank|ranking|episode|episodes|season|seasons)\b/.test(
      lower
    );
    const hasCategoryWords = /\b(movie|movies|show|shows|series|tv)\b/.test(lower);

    return words.length <= 4 && !hasControlWords && !hasCategoryWords;
  };

  // “top 10…”, “best…”, “highest rated…” etc → ranking mode
  const isRankingQueryText = (q: string) => {
    const lower = q.toLowerCase();
    return /\b(top|best|highest rated|top-rated|top rated)\b/.test(lower);
  };

  const extractTopNFromQuery = (q: string): number | null => {
    const match = q.match(/\btop\s+(\d+)\b/i);
    if (!match) return null;
    const n = parseInt(match[1], 10);
    if (Number.isNaN(n)) return null;
    return Math.max(1, Math.min(n, 100)); // clamp 1–100
  };

  // ---------- ACTIONS ----------

  const loadTrending = async () => {
    if (!state.tmdbKey) return;
    setIsRankingView(false);
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      view: 'trending',
      selectedItem: null,
      selectedPerson: null,
    }));
    try {
      const results = await tmdb.getTrending(state.tmdbKey);
      setState((prev) => ({
        ...prev,
        searchResults: results,
        isLoading: false,
        aiExplanation: "Here's what's popular today across movies and TV.",
      }));
    } catch (e) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load trending content. Check your API Key.',
      }));
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawQuery = state.searchQuery.trim();
    if (!rawQuery || !state.tmdbKey) return;

    // 1) DIRECT TITLE SEARCH (NO AI) → better simple “Rick and Morty” results
    if (isPlainTitleQuery(rawQuery)) {
      setIsRankingView(false);
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        aiExplanation: null,
      }));

      try {
        const directResults = await tmdb.searchMulti(state.tmdbKey, rawQuery);
        setState((prev) => ({
          ...prev,
          searchResults: directResults,
          isLoading: false,
          view: 'search',
          aiExplanation: `Direct search results for "${rawQuery}".`,
        }));
      } catch (err) {
        console.error(err);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            'Sorry, I had trouble searching that title. Please try again or check your TMDB key.',
        }));
      }
      return;
    }

    // 2) AI SEARCH (Gemini / OpenAI) FOR MORE COMPLEX QUERIES
    if (!state.geminiKey && !state.openaiKey) {
      alert(
        'Please add your Gemini or OpenAI API Key in settings to use AI-powered search.'
      );
      setIsSettingsOpen(true);
      return;
    }

    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      aiExplanation: null,
    }));

    try {
      // AI analysis: OpenAI preferred if available
      let analysis: GeminiFilter;
      if (state.openaiKey) {
        analysis = await analyzeQueryWithOpenAI(rawQuery, state.openaiKey);
      } else {
        analysis = await analyzeQuery(rawQuery, state.geminiKey);
      }

      let results: MediaItem[] = [];
      let explanation =
        analysis.explanation || 'Results based on your search.';

      const rankingByText = isRankingQueryText(rawQuery);
      const isEpisodeRanking = analysis.searchType === 'episode_ranking';
      let rankingIntent = rankingByText || isEpisodeRanking;

      // determine desired limit (from AI or "top 50 ..." etc)
      let requestedLimit =
        (analysis.limit && analysis.limit > 0 ? analysis.limit : 20) || 20;
      const topN = extractTopNFromQuery(rawQuery);
      if (topN && topN > requestedLimit) {
        requestedLimit = topN;
      }
      requestedLimit = Math.max(1, Math.min(requestedLimit, 100));

      // 2.a) TRENDING
      if (analysis.searchType === 'trending') {
        rankingIntent = false;
        results = await tmdb.getTrending(state.tmdbKey);
      }

      // 2.b) EPISODE RANKING
      else if (isEpisodeRanking && analysis.query) {
        explanation = `Finding top ranked episodes for "${analysis.query}"...`;
        setState((prev) => ({ ...prev, aiExplanation: explanation }));

        const showId = await tmdb.findIdByName(
          state.tmdbKey,
          'tv',
          analysis.query
        );
        if (!showId) throw new Error('Could not find that TV show.');

        const seasons = await tmdb.getShowSeasons(state.tmdbKey, showId);

        const fetchPromises = seasons
          .filter((s) => s.season_number > 0)
          .slice(0, 15)
          .map((s) =>
            tmdb.getSeasonEpisodes(
              state.tmdbKey,
              showId,
              s.season_number
            )
          );

        const seasonsEpisodes = await Promise.all(fetchPromises);
        const allEpisodes: Episode[] = seasonsEpisodes.flat();

        const sorted = allEpisodes.sort(
          (a, b) => b.vote_average - a.vote_average
        );

        const episodeLimit = Math.min(requestedLimit, sorted.length);
        results = sorted.slice(0, episodeLimit).map((ep) => ({
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
        }));
        explanation = `Top ${results.length} highest-rated episodes of ${analysis.query}.`;
      }

      // 2.c) GENERAL SEARCH / DISCOVERY (TOP X, FILTERS, ETC.)
      else {
        let personId = null;
        if (analysis.with_people) {
          personId = await tmdb.getPersonId(
            state.tmdbKey,
            analysis.with_people
          );
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

        // If query looks like ranking ("top 50 sci fi movies"), bias towards vote_average.desc
        if (rankingIntent) {
          params.sort_by = 'vote_average.desc';
          // IMPORTANT: remove tiny-vote noise
          params['vote_count.gte'] = '500';
        }

        if (analysis.media_type) {
          // Fetch multiple pages if we need more than 20 items (TMDB page size)
          const pageSize = 20;
          const pagesNeeded = Math.ceil(requestedLimit / pageSize);
          const all: MediaItem[] = [];

          for (let page = 1; page <= pagesNeeded; page++) {
            const pageParams = { ...params, page: String(page) };
            const pageResults = await tmdb.discoverMedia(
              state.tmdbKey,
              analysis.media_type,
              pageParams
            );
            all.push(...pageResults);
            if (all.length >= requestedLimit) break;
          }

          results = all.slice(0, requestedLimit);
        } else {
          // Fallback: generic search
          results = await tmdb.searchMulti(
            state.tmdbKey,
            analysis.query || rawQuery
          );
        }

        // For ranking-style queries (non-episode), ensure strict rating sort
        if (rankingIntent && !isEpisodeRanking) {
          results = [...results].sort(
            (a, b) => (b.vote_average || 0) - (a.vote_average || 0)
          );
        }
      }

      setIsRankingView(rankingIntent);

      setState((prev) => ({
        ...prev,
        searchResults: results,
        isLoading: false,
        view: 'search',
        aiExplanation: explanation,
      }));
    } catch (e) {
      console.error(e);
      setIsRankingView(false);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error:
          'Sorry, I had trouble finding that. Try a simpler search or check your keys.',
      }));
    }
  };

  const handleCardClick = async (item: MediaItem) => {
    // Simple alert for episode-ranking pseudo-items
    if ((item as any).season_number) {
      alert(
        `${item.name}\nSeason ${
          (item as any).season_number
        }, Episode ${
          (item as any).episode_number
        }\nRating: ${item.vote_average}\n\n${item.overview}`
      );
      return;
    }

    if (!state.tmdbKey) return;
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const details = await tmdb.getDetails(
        state.tmdbKey,
        item.media_type as 'movie' | 'tv',
        item.id
      );
      setState((prev) => ({
        ...prev,
        selectedItem: details,
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

  const handleCastClick = async (personId: number) => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      selectedItem: null,
    }));
    try {
      const person = await tmdb.getPersonDetails(
        state.tmdbKey,
        personId
      );
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

  const toggleList = (listType: 'favorites' | 'watchlist', item: MediaItem) => {
    setState((prev) => {
      const list = prev[listType];
      const exists = list.find((i) => i.id === item.id);
      const newList = exists
        ? list.filter((i) => i.id !== item.id)
        : [...list, item];
      return { ...prev, [listType]: newList };
    });
  };

  // ---------- RATING HANDLER ----------
  const handleRating = (itemId: string, rating: number) => {
    setState((prev) => ({
      ...prev,
      userRatings: {
        ...prev.userRatings,
        [itemId]: rating,
      },
    }));
  };

  // ---------- AUTH HANDLERS ----------
  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error('Login error:', err);
      alert('Google login failed. Check console for details.');
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // ---------- GRID RENDER (with optional ranking numbers) ----------
  const renderGrid = (items: MediaItem[], showRanks: boolean = false) => (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
      {items.map((item, idx) => (
        <MediaCard
          key={`${item.id}-${(item as any).episode_number || 0}`}
          item={item}
          onClick={handleCardClick}
          rank={showRanks ? idx + 1 : undefined}
        />
      ))}
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
            onClick={loadTrending}
          >
            <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-2.5 rounded-xl shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition-all duration-300">
              <Video className="text-white fill-white" size={20} />
            </div>
            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 hidden md:block">
              CineMind
            </span>
          </div>

          {/* Search Bar */}
          <form
            onSubmit={handleSearch}
            className="flex-1 max-w-2xl relative group"
          >
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Sparkles
                className={`w-5 h-5 transition-colors ${
                  state.isLoading
                    ? 'animate-pulse text-cyan-400'
                    : 'text-slate-500 group-focus-within:text-cyan-400'
                }`}
              />
            </div>
            <input
              type="text"
              value={state.searchQuery}
              onChange={(e) =>
                setState((prev) => ({
                  ...prev,
                  searchQuery: e.target.value,
                }))
              }
              placeholder="Ask anything (e.g. 'Top 50 sci-fi movies', 'Rick and Morty', 'Best crime thrillers since 2010')"
              className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:bg-slate-900 focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all shadow-inner"
            />
            {state.isLoading && (
              <div className="absolute inset-y-0 right-4 flex items-center">
                <Loader2 className="animate-spin text-cyan-500" size={20} />
              </div>
            )}
          </form>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            {isSyncingCloud && currentUser && (
              <div className="flex items-center gap-1 text-xs text-cyan-300">
                <Loader2 size={14} className="animate-spin" />
                <span>Syncing</span>
              </div>
            )}

            {currentUser ? (
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 text-xs md:text-sm rounded-xl bg-slate-900/60 border border-white/10 hover:border-red-400/60 hover:bg-red-500/10 transition"
              >
                {currentUser.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt={currentUser.displayName || 'User'}
                    className="w-6 h-6 rounded-full"
                  />
                ) : (
                  <UserCircle size={18} />
                )}
                <span className="hidden md:inline max-w-[120px] truncate">
                  {currentUser.displayName || currentUser.email}
                </span>
                <LogOut size={16} className="hidden md:inline" />
              </button>
            ) : (
              <button
                onClick={handleLogin}
                className="flex items-center gap-2 px-3 py-2 text-xs md:text-sm rounded-xl bg-slate-900/60 border border-white/10 hover:border-cyan-400/60 hover:bg-cyan-500/10 transition"
              >
                <LogIn size={16} />
                <span className="hidden md:inline">
                  Sign in with Google
                </span>
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
        {/* AI Explanation Banner */}
        {state.aiExplanation && !state.isLoading && (
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

        {/* Error Banner */}
        {state.error && (
          <div className="mb-8 bg-red-950/20 border border-red-500/30 p-4 rounded-2xl text-red-200 text-center flex flex-col items-center gap-2">
            <Loader2 className="animate-spin text-red-400" size={24} />
            {state.error}
          </div>
        )}

        {state.view === 'library' ? (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 flex items-center gap-3">
                <Library className="text-cyan-500" /> My Library
              </h2>

              {/* Tab Switcher */}
              <div className="bg-slate-900/50 p-1.5 rounded-xl flex gap-1 border border-white/5 backdrop-blur-md">
                <button
                  onClick={() => setLibraryTab('favorites')}
                  className={`px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                    libraryTab === 'favorites'
                      ? 'bg-slate-800 text-white shadow-lg ring-1 ring-white/10'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Heart
                    size={16}
                    className={
                      libraryTab === 'favorites'
                        ? 'text-pink-500 fill-pink-500'
                        : ''
                    }
                  />{' '}
                  Favorites
                </button>
                <button
                  onClick={() => setLibraryTab('watchlist')}
                  className={`px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                    libraryTab === 'watchlist'
                      ? 'bg-slate-800 text-white shadow-lg ring-1 ring-white/10'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <List
                    size={16}
                    className={
                      libraryTab === 'watchlist' ? 'text-emerald-500' : ''
                    }
                  />{' '}
                  Watchlist
                </button>
              </div>
            </div>

            {/* Filters */}
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

            {/* Grid */}
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
        ) : (
          <div className="animate-in fade-in duration-500">
            <h2 className="text-3xl font-bold text-white mb-8 capitalize flex items-center gap-3">
              <span className="w-2 h-8 bg-cyan-500 rounded-full" />
              {state.view === 'trending' ? 'Trending Now' : 'Search Results'}
            </h2>
            {state.searchResults.length > 0 ? (
              renderGrid(state.searchResults, isRankingView)
            ) : (
              !state.isLoading && (
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

      {/* NAVIGATION BAR (MOBILE) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#020617]/90 backdrop-blur-xl border-t border-white/5 z-40 pb-safe">
        <div className="flex justify-around p-4">
          <button
            onClick={loadTrending}
            className={`flex flex-col items-center gap-1.5 transition-colors ${
              state.view === 'trending'
                ? 'text-cyan-400'
                : 'text-slate-500'
            }`}
          >
            <Home
              size={24}
              strokeWidth={state.view === 'trending' ? 2.5 : 2}
            />
            <span className="text-[10px] font-bold uppercase tracking-wide">
              Home
            </span>
          </button>
          <button
            onClick={() =>
              setState((prev) => ({ ...prev, view: 'library' }))
            }
            className={`flex flex-col items-center gap-1.5 transition-colors ${
              state.view === 'library'
                ? 'text-cyan-400'
                : 'text-slate-500'
            }`}
          >
            <Library
              size={24}
              strokeWidth={state.view === 'library' ? 2.5 : 2}
            />
            <span className="text-[10px] font-bold uppercase tracking-wide">
              My List
            </span>
          </button>
        </div>
      </nav>

      {/* MODALS */}
      {state.selectedItem && (
        <DetailView
          item={state.selectedItem}
          onClose={() =>
            setState((prev) => ({ ...prev, selectedItem: null }))
          }
          apiKey={state.tmdbKey}
          onToggleFavorite={(i) => toggleList('favorites', i)}
          onToggleWatchlist={(i) => toggleList('watchlist', i)}
          isFavorite={state.favorites.some(
            (f) => f.id === state.selectedItem?.id
          )}
          isWatchlist={state.watchlist.some(
            (w) => w.id === state.selectedItem?.id
          )}
          onCastClick={handleCastClick}
          userRatings={state.userRatings}
          onRate={handleRating}
        />
      )}

      {state.selectedPerson && (
        <PersonView
          person={state.selectedPerson}
          onClose={() =>
            setState((prev) => ({ ...prev, selectedPerson: null }))
          }
          onMediaClick={handleCardClick}
        />
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentKey={state.tmdbKey}
        currentGeminiKey={state.geminiKey}
        currentOpenAIKey={state.openaiKey}
        onSave={async (key, geminiKey, openaiKey) => {
          localStorage.setItem('tmdb_key', key);
          localStorage.setItem('gemini_key', geminiKey);
          localStorage.setItem('openai_key', openaiKey);

          setState((prev) => ({ ...prev, tmdbKey: key, geminiKey, openaiKey }));

          if (currentUser) {
            try {
              await saveUserData(currentUser.uid, {
                tmdbKey: key,
                geminiKey,
                openaiKey,
              });
            } catch (err) {
              console.error('Error saving keys to Firestore:', err);
            }
          }
        }}
      />
    </div>
  );
};

export default App;