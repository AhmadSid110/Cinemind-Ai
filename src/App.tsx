// src/App.tsx
import React, { useState, useEffect } from 'react';
import {
  Home, Library, Settings, Sparkles, Loader2, Video, LogIn, LogOut,
} from 'lucide-react';

import { MediaItem, AppState } from './types';
import * as tmdb from './services/tmdbService';
import MediaCard from './components/MediaCard';
import DetailView from './components/DetailView';
import PersonView from './components/PersonView';
import SettingsModal from './components/SettingsModal';
import { useMediaSearch } from './hooks/useMediaSearch';
import { auth, loginWithGoogle, subscribeToAuthChanges, loadUserData, saveUserData } from './firebase';

const App: React.FC = () => {
  // ---------- GLOBAL STATE ----------
  const [state, setState] = useState<AppState>({
    view: 'trending',
    tmdbKey: localStorage.getItem('tmdb_key') || '',
    
    // Multi-Key Support (Array)
    geminiKeys: (() => {
        try {
            const list = JSON.parse(localStorage.getItem('gemini_keys_list') || '[]');
            if (Array.isArray(list) && list.length > 0) return list;
        } catch (e) {}
        const old = localStorage.getItem('gemini_key');
        return old ? [old] : [];
    })(),

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
  const [libraryTab, setLibraryTab] = useState<'favorites' | 'watchlist'>('favorites');
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'movie' | 'tv' | 'animation'>('all');

  // ---------- TRENDING DATA ----------
  const [trendingMovies, setTrendingMovies] = useState<MediaItem[]>([]);
  const [trendingTv, setTrendingTv] = useState<MediaItem[]>([]);
  const [nowPlayingMovies, setNowPlayingMovies] = useState<MediaItem[]>([]);
  const [onAirTv, setOnAirTv] = useState<MediaItem[]>([]);

  // ---------- SEARCH HOOK ----------
  const searchHook = useMediaSearch({
    tmdbKey: state.tmdbKey,
    geminiKeys: state.geminiKeys || [], 
    trendingMovies,
    trendingTv
  });

  // Sync Search Results to View
  useEffect(() => {
    if (searchHook.results.length > 0 || searchHook.explanation) {
       setState(prev => ({ 
           ...prev, 
           view: 'search',
           searchResults: searchHook.results,
           aiExplanation: searchHook.explanation,
           isLoading: false
       }));
    }
  }, [searchHook.results, searchHook.explanation]);

  // ---------- FIREBASE ----------
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [hasLoadedCloud, setHasLoadedCloud] = useState(false);

  useEffect(() => {
    localStorage.setItem('favorites', JSON.stringify(state.favorites));
    localStorage.setItem('watchlist', JSON.stringify(state.watchlist));
    localStorage.setItem('userRatings', JSON.stringify(state.userRatings));
  }, [state.favorites, state.watchlist, state.userRatings]);

  useEffect(() => {
    if (state.tmdbKey) loadHomeSections();
  }, [state.tmdbKey]);

  useEffect(() => {
    const unsub = subscribeToAuthChanges(async (user) => {
      setCurrentUser(user);
      setHasLoadedCloud(false);
      if (!user) return;
      try {
        const cloud = await loadUserData(user.uid);
        if (cloud) {
          setState(prev => ({
            ...prev,
            favorites: cloud.favorites || [],
            watchlist: cloud.watchlist || [],
            tmdbKey: cloud.tmdbKey || prev.tmdbKey,
            geminiKeys: cloud.geminiKeys || prev.geminiKeys,
            userRatings: cloud.userRatings || {},
          }));
        }
      } catch (err) { console.error(err); } 
      finally { setHasLoadedCloud(true); }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!currentUser || !hasLoadedCloud) return;
    const sync = async () => {
        try {
            await saveUserData(currentUser.uid, {
                favorites: state.favorites,
                watchlist: state.watchlist,
                tmdbKey: state.tmdbKey,
                geminiKeys: state.geminiKeys,
                userRatings: state.userRatings,
            });
        } catch (e) { console.error(e); }
    };
    const timer = setTimeout(sync, 2000);
    return () => clearTimeout(timer);
  }, [currentUser, hasLoadedCloud, state]);

  // ---------- ACTIONS ----------
  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error("Login failed", err);
      alert("Login failed. Check console.");
    }
  };

  const loadHomeSections = async () => {
    if (!state.tmdbKey) return;
    setState(prev => ({ ...prev, isLoading: true, view: 'trending' }));
    try {
      const [tm, tt, npm, oat] = await Promise.all([
        tmdb.getTrendingMovies(state.tmdbKey),
        tmdb.getTrendingTv(state.tmdbKey),
        tmdb.getNowPlayingMovies(state.tmdbKey),
        tmdb.getOnTheAirTv(state.tmdbKey),
      ]);
      setTrendingMovies(tm); setTrendingTv(tt); setNowPlayingMovies(npm); setOnAirTv(oat);
      setState(prev => ({ ...prev, isLoading: false }));
    } catch (e) {
      setState(prev => ({ ...prev, isLoading: false, error: 'Failed to load home.' }));
    }
  };

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    searchHook.search();
  };

  const handleCardClick = async (item: MediaItem) => {
    if ((item as any).season_number) { alert(`${item.name} (Episode)`); return; }
    setState(prev => ({ ...prev, isLoading: true }));
    try {
        const details = await tmdb.getDetails(state.tmdbKey, item.media_type as 'movie' | 'tv', item.id);
        setState(prev => ({ ...prev, selectedItem: details, isLoading: false }));
    } catch (e) { setState(prev => ({ ...prev, isLoading: false })); }
  };

  const toggleList = (type: 'favorites' | 'watchlist', item: MediaItem) => {
    setState(prev => {
        const list = prev[type];
        const exists = list.find(i => i.id === item.id);
        return { ...prev, [type]: exists ? list.filter(i => i.id !== item.id) : [...list, item] };
    });
  };

  const getFilteredLibrary = () => {
    const list = libraryTab === 'favorites' ? state.favorites : state.watchlist;
    if (libraryFilter === 'all') return list;
    if (libraryFilter === 'animation') return list.filter(i => i.genre_ids?.includes(16));
    return list.filter(i => i.media_type === libraryFilter);
  };

  // ---------- RENDER ----------
  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans pb-24 selection:bg-cyan-500/30">
      <header className="sticky top-0 z-40 bg-[#020617]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={loadHomeSections}>
            <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-2.5 rounded-xl shadow-lg"><Video className="text-white" size={20} /></div>
            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 hidden md:block">CineMind</span>
          </div>

          <form onSubmit={onSearchSubmit} className="flex-1 max-w-2xl relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Sparkles className={`w-5 h-5 ${searchHook.isSearching ? 'animate-pulse text-cyan-400' : 'text-slate-500'}`} />
            </div>
            <input
              type="text"
              value={searchHook.searchQuery}
              onChange={(e) => searchHook.setSearchQuery(e.target.value)}
              placeholder="Search movies, TV, or ask 'Top 10 horror series'"
              className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-slate-200 outline-none focus:border-cyan-500/50 transition-all"
            />
            {searchHook.isSearching && <div className="absolute inset-y-0 right-4 flex items-center"><Loader2 className="animate-spin text-cyan-500" size={20} /></div>}
            
            {searchHook.suggestions.length > 0 && (
                <div className="absolute mt-2 left-0 right-0 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50">
                    {searchHook.suggestions.map((s, i) => (
                        <button key={i} onClick={() => searchHook.selectSuggestion(s)} className="w-full text-left px-4 py-3 hover:bg-slate-800 border-b border-white/5 last:border-0 text-sm flex justify-between">
                            <span>{s.title || s.name}</span>
                            <span className="text-xs text-slate-500 uppercase">{s.media_type}</span>
                        </button>
                    ))}
                </div>
            )}
          </form>

          <div className="flex items-center gap-3">
            {currentUser ? (
                 <button onClick={() => auth.signOut()} className="p-2 bg-slate-800 rounded-xl"><LogOut size={20} /></button>
            ) : (
                 <button onClick={handleLogin} className="p-2 bg-slate-800 rounded-xl"><LogIn size={20} /></button>
            )}
            <button onClick={() => setIsSettingsOpen(true)} className="p-3 text-slate-400 hover:text-white rounded-xl border border-transparent hover:border-white/10"><Settings size={22} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-10">
        {state.aiExplanation && (
          <div className="mb-10 bg-gradient-to-r from-cyan-950/30 to-blue-950/30 border border-cyan-500/20 p-5 rounded-2xl flex items-start gap-4 animate-in fade-in slide-in-from-top-4">
            <div className="p-2 bg-cyan-500/10 rounded-lg"><Sparkles className="text-cyan-400" size={20} /></div>
            <div><h3 className="text-cyan-200 font-bold text-sm">AI ANALYSIS</h3><p className="text-slate-300">{state.aiExplanation}</p></div>
          </div>
        )}

        {state.view === 'library' ? (
           <div className="space-y-8 animate-in fade-in">
              <div className="flex justify-between items-center">
                  <h2 className="text-3xl font-bold text-white flex gap-3"><Library className="text-cyan-500" /> My Library</h2>
                  <div className="bg-slate-900 p-1 rounded-xl flex gap-1">
                      <button onClick={() => setLibraryTab('favorites')} className={`px-4 py-2 rounded-lg text-sm font-bold ${libraryTab === 'favorites' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>Favorites</button>
                      <button onClick={() => setLibraryTab('watchlist')} className={`px-4 py-2 rounded-lg text-sm font-bold ${libraryTab === 'watchlist' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}>Watchlist</button>
                  </div>
              </div>
              <div className="flex gap-3 pb-4">
                  {['all', 'movie', 'tv'].map(f => (
                      <button key={f} onClick={() => setLibraryFilter(f as any)} className={`px-4 py-2 rounded-full text-sm font-bold border ${libraryFilter === f ? 'bg-cyan-600 border-cyan-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>
                          {f.toUpperCase()}
                      </button>
                  ))}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {getFilteredLibrary().map(item => (
                      <MediaCard key={item.id} item={item} onClick={handleCardClick} />
                  ))}
              </div>
           </div>
        ) : state.view === 'trending' ? (
           <div className="space-y-10 animate-in fade-in">
              <section>
                 <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3"><span className="w-2 h-8 bg-cyan-500 rounded-full"/> Trending Movies</h2>
                 <div className="grid grid-cols-2 md:grid-cols-5 gap-6">{trendingMovies.slice(0, 10).map(i => <MediaCard key={i.id} item={i} onClick={handleCardClick}/>)}</div>
              </section>
              <section>
                 <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3"><span className="w-2 h-8 bg-fuchsia-500 rounded-full"/> Trending Series</h2>
                 <div className="grid grid-cols-2 md:grid-cols-5 gap-6">{trendingTv.slice(0, 10).map(i => <MediaCard key={i.id} item={i} onClick={handleCardClick}/>)}</div>
              </section>
           </div>
        ) : (
           <div className="animate-in fade-in">
              <h2 className="text-3xl font-bold text-white mb-8 border-l-4 border-cyan-500 pl-4">Search Results</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                  {state.searchResults.map((item, idx) => (
                      <MediaCard key={item.id} item={item} onClick={handleCardClick} rank={idx + 1} />
                  ))}
              </div>
           </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-[#020617]/90 backdrop-blur-xl border-t border-white/5 z-40 pb-safe">
         <div className="flex justify-around p-4">
            <button onClick={loadHomeSections} className={`flex flex-col items-center gap-1 ${state.view === 'trending' ? 'text-cyan-400' : 'text-slate-500'}`}><Home size={24}/><span className="text-[10px] font-bold">HOME</span></button>
            <button onClick={() => setState(p => ({...p, view: 'library'}))} className={`flex flex-col items-center gap-1 ${state.view === 'library' ? 'text-cyan-400' : 'text-slate-500'}`}><Library size={24}/><span className="text-[10px] font-bold">MY LIST</span></button>
         </div>
      </nav>

      {state.selectedItem && <DetailView item={state.selectedItem} onClose={() => setState(p => ({...p, selectedItem: null}))} apiKey={state.tmdbKey} onToggleFavorite={i => toggleList('favorites', i)} onToggleWatchlist={i => toggleList('watchlist', i)} isFavorite={state.favorites.some(f => f.id === state.selectedItem?.id)} isWatchlist={state.watchlist.some(w => w.id === state.selectedItem?.id)} onCastClick={() => {}} userRatings={state.userRatings} onRate={(id, r) => setState(p => ({...p, userRatings: {...p.userRatings, [id]: r}}))} />}
      {state.selectedPerson && <PersonView person={state.selectedPerson} onClose={() => setState(p => ({...p, selectedPerson: null}))} onMediaClick={handleCardClick} />}
      
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        currentKey={state.tmdbKey} 
        currentGeminiKeys={state.geminiKeys} 
        onSave={(key, keys) => {
            localStorage.setItem('tmdb_key', key);
            localStorage.setItem('gemini_keys_list', JSON.stringify(keys));
            setState(p => ({ ...p, tmdbKey: key, geminiKeys: keys }));
            if (currentUser) saveUserData(currentUser.uid, { tmdbKey: key, geminiKeys: keys });
        }} 
      />
    </div>
  );
};

export default App;
