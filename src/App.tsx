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
  UserCircle
} from 'lucide-react';

import { MediaItem, AppState, Episode, GeminiFilter } from './types';
import * as tmdb from './services/tmdbService';
import { analyzeQuery } from './services/geminiService';
import MediaCard from './components/MediaCard';
import DetailView from './components/DetailView';
import PersonView from './components/PersonView';
import SettingsModal from './components/SettingsModal';

// Firebase helpers (you must create src/firebase.ts)
import {
  auth,
  loginWithGoogle,
  subscribeToAuthChanges,
  loadUserData,
  saveUserData,
} from './firebase';

const App: React.FC = () => {
  // ----- APP STATE -----
  const [state, setState] = useState<AppState>({
    view: 'trending',
    searchQuery: '',
    tmdbKey: localStorage.getItem('tmdb_key') || '',
    geminiKey: localStorage.getItem('gemini_key') || process.env.API_KEY || '',
    searchResults: [],
    selectedItem: null,
    selectedPerson: null,
    isLoading: false,
    error: null,
    favorites: JSON.parse(localStorage.getItem('favorites') || '[]'),
    watchlist: JSON.parse(localStorage.getItem('watchlist') || '[]'),
    aiExplanation: null,
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(!state.tmdbKey);
  const [libraryTab, setLibraryTab] = useState<'favorites' | 'watchlist'>('favorites');
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'movie' | 'tv' | 'animation'>('all');

  // ----- FIREBASE USER STATE -----
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  // ----- LOCAL PERSISTENCE -----
  useEffect(() => {
    localStorage.setItem('favorites', JSON.stringify(state.favorites));
    localStorage.setItem('watchlist', JSON.stringify(state.watchlist));
  }, [state.favorites, state.watchlist]);

  useEffect(() => {
    if (state.tmdbKey) {
      localStorage.setItem('tmdb_key', state.tmdbKey);
    }
    if (state.geminiKey) {
      localStorage.setItem('gemini_key', state.geminiKey);
    }
  }, [state.tmdbKey, state.geminiKey]);

  // ----- LOAD TRENDING WHEN TMDB KEY AVAILABLE -----
  useEffect(() => {
    if (state.tmdbKey) {
      loadTrending();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tmdbKey]);

  // ----- FIREBASE AUTH SUBSCRIPTION -----
  useEffect(() => {
    const unsub = subscribeToAuthChanges(async (user) => {
      setCurrentUser(user);

      if (user) {
        try {
          setIsSyncingCloud(true);
          const cloud = await loadUserData(user.uid);

          if (cloud) {
            setState((prev) => ({
              ...prev,
              favorites: cloud.favorites || prev.favorites,
              watchlist: cloud.watchlist || prev.watchlist,
              tmdbKey: cloud.tmdbKey || prev.tmdbKey,
              geminiKey: cloud.geminiKey || prev.geminiKey,
            }));

            // keep localStorage in sync as well
            if (cloud.tmdbKey) localStorage.setItem('tmdb_key', cloud.tmdbKey);
            if (cloud.geminiKey) localStorage.setItem('gemini_key', cloud.geminiKey);
            if (cloud.favorites) localStorage.setItem('favorites', JSON.stringify(cloud.favorites));
            if (cloud.watchlist) localStorage.setItem('watchlist', JSON.stringify(cloud.watchlist));
          }
        } catch (err) {
          console.error('Error loading user cloud data:', err);
        } finally {
          setIsSyncingCloud(false);
        }
      }
    });

    return () => unsub();
  }, []);

  // ----- SYNC FAVORITES / WATCHLIST / KEYS TO FIRESTORE WHEN LOGGED IN -----
  useEffect(() => {
    const sync = async () => {
      if (!currentUser) return;
      try {
        setIsSyncingCloud(true);
        await saveUserData(currentUser.uid, {
          favorites: state.favorites,
          watchlist: state.watchlist,
          tmdbKey: state.tmdbKey,
          geminiKey: state.geminiKey,
        });
      } catch (err) {
        console.error('Error syncing to Firestore:', err);
      } finally {
        setIsSyncingCloud(false);
      }
    };

    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, state.favorites, state.watchlist, state.tmdbKey, state.geminiKey]);

  // ----- ACTIONS -----

  const loadTrending = async () => {
    if (!state.tmdbKey) return;
    setState(prev => ({ 
      ...prev, 
      isLoading: true, 
      error: null, 
      view: 'trending', 
      selectedItem: null, 
      selectedPerson: null 
    }));
    try {
      const results = await tmdb.getTrending(state.tmdbKey);
      setState(prev => ({ 
        ...prev, 
        searchResults: results, 
        isLoading: false, 
        aiExplanation: "Here's what's popular today across movies and TV." 
      }));
    } catch (e) {
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Failed to load trending content. Check your API Key.' 
      }));
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.searchQuery.trim() || !state.tmdbKey) return;

    if (!state.geminiKey) {
      alert("Please add your Gemini API Key in settings to use AI Search.");
      setIsSettingsOpen(true);
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null, aiExplanation: null }));

    try {
      // 1. Analyze with Gemini
      const analysis: GeminiFilter = await analyzeQuery(state.searchQuery, state.geminiKey);
      let results: MediaItem[] = [];
      let explanation = analysis.explanation || "Results based on your search.";

      // 2. Execute Logic based on Type
      if (analysis.searchType === 'trending') {
        results = await tmdb.getTrending(state.tmdbKey);
      } 
      else if (analysis.searchType === 'episode_ranking' && analysis.query) {
        // Complex Episode Ranking Logic
        explanation = `Finding top ranked episodes for "${analysis.query}"...`;
        setState(prev => ({...prev, aiExplanation: explanation})); // Intermediate feedback

        // Find Show ID
        const showId = await tmdb.findIdByName(state.tmdbKey, 'tv', analysis.query);
        if (!showId) throw new Error("Could not find that TV show.");

        // Get Seasons
        const seasons = await tmdb.getShowSeasons(state.tmdbKey, showId);

        // Fetch All Episodes (Limit to first 15 seasons)
        const fetchPromises = seasons
          .filter(s => s.season_number > 0) // Skip specials
          .slice(0, 15)
          .map(s => tmdb.getSeasonEpisodes(state.tmdbKey, showId, s.season_number));

        const seasonsEpisodes = await Promise.all(fetchPromises);
        const allEpisodes: Episode[] = seasonsEpisodes.flat();

        // Sort by Rating
        const sorted = allEpisodes.sort((a, b) => b.vote_average - a.vote_average);

        // Map to MediaItem format for display
        results = sorted.slice(0, analysis.limit || 10).map(ep => ({
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
          episode_number: ep.episode_number
        }));
        explanation = `Top ${results.length} highest-rated episodes of ${analysis.query}.`;

      } else {
        // General Search / Discovery
        let personId = null;
        if (analysis.with_people) {
          personId = await tmdb.getPersonId(state.tmdbKey, analysis.with_people);
        }

        const params: any = {
          sort_by: analysis.sort_by || 'popularity.desc',
          ...(analysis.genres && { with_genres: analysis.genres.join(',') }),
          ...(analysis.year && { primary_release_year: analysis.year, first_air_date_year: analysis.year }),
          ...(personId && { with_people: personId }),
          ...(analysis.language && { with_original_language: analysis.language })
        };

        if (analysis.media_type) {
          results = await tmdb.discoverMedia(state.tmdbKey, analysis.media_type, params);
        } else {
          results = await tmdb.searchMulti(state.tmdbKey, analysis.query || state.searchQuery);
        }
      }

      setState(prev => ({ 
        ...prev, 
        searchResults: results, 
        isLoading: false, 
        view: 'search',
        aiExplanation: explanation
      }));

    } catch (e) {
      console.error(e);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: "Sorry, I had trouble finding that. Try a simpler search or check your keys." 
      }));
    }
  };

  const handleCardClick = async (item: MediaItem) => {
    // If it's an episode ranking item, simple alert
    if ((item as any).season_number) {
      alert(`${item.name}\nSeason ${(item as any).season_number}, Episode ${(item as any).episode_number}\nRating: ${item.vote_average}\n\n${item.overview}`);
      return;
    }

    if (!state.tmdbKey) return;
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const details = await tmdb.getDetails(state.tmdbKey, item.media_type as 'movie'|'tv', item.id);
      setState(prev => ({ ...prev, selectedItem: details, isLoading: false, selectedPerson: null }));
    } catch (e) {
      setState(prev => ({ ...prev, isLoading: false, error: "Could not load details." }));
    }
  };

  const handleCastClick = async (personId: number) => {
    setState(prev => ({ ...prev, isLoading: true, selectedItem: null }));
    try {
      const person = await tmdb.getPersonDetails(state.tmdbKey, personId);
      setState(prev => ({ ...prev, selectedPerson: person, isLoading: false }));
    } catch (e) {
      setState(prev => ({ ...prev, isLoading: false, error: "Could not load person details." }));
    }
  };

  const toggleList = (listType: 'favorites' | 'watchlist', item: MediaItem) => {
    setState(prev => {
      const list = prev[listType];
      const exists = list.find(i => i.id === item.id);
      let newList;
      if (exists) {
        newList = list.filter(i => i.id !== item.id);
      } else {
        newList = [...list, item];
      }
      return { ...prev, [listType]: newList };
    });
  };

  // ----- AUTH HANDLERS -----
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

  // ----- HELPERS -----
  const renderGrid = (items: MediaItem[]) => (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
      {items.map((item) => (
        <MediaCard 
          key={`${item.id}-${(item as any).episode_number || 0}`} 
          item={item} 
          onClick={handleCardClick} 
        />
      ))}
    </div>
  );

  const getFilteredLibrary = () => {
    const list = libraryTab === 'favorites' ? state.favorites : state.watchlist;
    if (libraryFilter === 'all') return list;
    if (libraryFilter === 'animation') return list.filter(i => i.genre_ids?.includes(16));
    return list.filter(i => i.media_type === libraryFilter);
  };

  // ----- RENDER -----
  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans pb-24 selection:bg-cyan-500/30 selection:text-cyan-100">

      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-[#020617]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between gap-6">

          {/* Logo / Home */}
          <div className="flex items-center gap-3 cursor-pointer group" onClick={loadTrending}>
            <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-2.5 rounded-xl shadow-lg shadow-cyan-500/20 group-hover:shadow-cyan-500/40 transition-all duration-300">
              <Video className="text-white fill-white" size={20} />
            </div>
            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 hidden md:block">
              CineMind
            </span>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="flex-1 max-w-2xl relative group">
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
              onChange={(e) => setState(prev => ({ ...prev, searchQuery: e.target.value }))}
              placeholder="What are you in the mood for? (e.g., 'Dark sci-fi movies like Interstellar')"
              className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:bg-slate-900 focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all shadow-inner"
            />
            {state.isLoading && (
              <div className="absolute inset-y-0 right-4 flex items-center">
                <Loader2 className="animate-spin text-cyan-500" size={20} />
              </div>
            )}
          </form>

          {/* Right actions: sync indicator, login, settings */}
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
              <p className="text-slate-300 leading-relaxed">{state.aiExplanation}</p>
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
                  <Heart size={16} className={libraryTab === 'favorites' ? 'text-pink-500 fill-pink-500' : ''} /> 
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
                  <List size={16} className={libraryTab === 'watchlist' ? 'text-emerald-500' : ''} /> 
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
              ].map(f => (
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
                renderGrid(getFilteredLibrary())
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
              <span className="w-2 h-8 bg-cyan-500 rounded-full"></span>
              {state.view === 'trending' ? 'Trending Now' : 'Search Results'}
            </h2>
            {state.searchResults.length > 0 
              ? renderGrid(state.searchResults)
              : !state.isLoading && (
                <div className="flex flex-col items-center justify-center py-32 text-slate-500">
                  <Sparkles size={64} className="mb-6 text-slate-800" />
                  <p className="text-xl font-light">
                    Start by typing what you feel like watching above.
                  </p>
                </div>
              )
            }
          </div>
        )}
      </main>

      {/* NAVIGATION BAR (MOBILE) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#020617]/90 backdrop-blur-xl border-t border-white/5 z-40 pb-safe">
        <div className="flex justify-around p-4">
          <button 
            onClick={loadTrending}
            className={`flex flex-col items-center gap-1.5 transition-colors ${
              state.view === 'trending' ? 'text-cyan-400' : 'text-slate-500'
            }`}
          >
            <Home size={24} strokeWidth={state.view === 'trending' ? 2.5 : 2} />
            <span className="text-[10px] font-bold uppercase tracking-wide">Home</span>
          </button>
          <button 
            onClick={() => setState(prev => ({ ...prev, view: 'library' }))}
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
          onClose={() => setState(prev => ({ ...prev, selectedItem: null }))}
          apiKey={state.tmdbKey}
          onToggleFavorite={(i) => toggleList('favorites', i)}
          onToggleWatchlist={(i) => toggleList('watchlist', i)}
          isFavorite={state.favorites.some(f => f.id === state.selectedItem?.id)}
          isWatchlist={state.watchlist.some(w => w.id === state.selectedItem?.id)}
          onCastClick={handleCastClick}
        />
      )}

      {state.selectedPerson && (
        <PersonView 
          person={state.selectedPerson}
          onClose={() => setState(prev => ({ ...prev, selectedPerson: null }))}
          onMediaClick={handleCardClick}
        />
      )}

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentKey={state.tmdbKey}
        currentGeminiKey={state.geminiKey}
        onSave={async (key, geminiKey) => {
          localStorage.setItem('tmdb_key', key);
          localStorage.setItem('gemini_key', geminiKey);

          setState(prev => ({ ...prev, tmdbKey: key, geminiKey }));

          // also sync keys to Firestore for logged-in user
          if (currentUser) {
            try {
              await saveUserData(currentUser.uid, {
                tmdbKey: key,
                geminiKey,
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
