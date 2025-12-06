import React, { useEffect, useState } from 'react';
import { X, Play, Plus, Check, Star, Calendar, Clock, Users, Video, ChevronDown, MonitorPlay, Film, ExternalLink } from 'lucide-react';
import { MediaDetail, MediaItem, Episode, CastMember, CrewMember } from '../types';
import { getSeasonEpisodes } from '../services/tmdbService';
import StarRating from './StarRating';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell
} from 'recharts';

interface DetailViewProps {
  item: MediaDetail;
  onClose: () => void;
  apiKey: string;
  onToggleFavorite: (item: MediaItem) => void;
  onToggleWatchlist: (item: MediaItem) => void;
  isFavorite: boolean;
  isWatchlist: boolean;
  onCastClick: (personId: number) => void;
  userRatings: { [key: string]: number };
  onRate: (itemId: string, rating: number) => void;
}

const DetailView: React.FC<DetailViewProps> = ({ 
  item, 
  onClose, 
  apiKey,
  onToggleFavorite,
  onToggleWatchlist,
  isFavorite,
  isWatchlist,
  onCastClick,
  userRatings,
  onRate
}) => {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);

  // Load initial season for TV shows
  useEffect(() => {
    if (item.media_type === 'tv' && item.seasons) {
        // Default to season 1 or the first available season
        const seasonToLoad = item.seasons.find(s => s.season_number > 0)?.season_number || 1;
        setSelectedSeason(seasonToLoad);
    }
  }, [item]);

  // Fetch episodes when season changes
  useEffect(() => {
    if (item.media_type === 'tv' && item.seasons && selectedSeason) {
        const fetchEpisodes = async () => {
            setLoadingEpisodes(true);
            const data = await getSeasonEpisodes(apiKey, item.id, selectedSeason);
            setEpisodes(data);
            setLoadingEpisodes(false);
        };
        fetchEpisodes();
    }
  }, [item, apiKey, selectedSeason]);

  const backdropUrl = item.backdrop_path 
    ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
    : 'https://picsum.photos/1920/1080';

  const title = item.title || item.name;
  const year = new Date(item.release_date || item.first_air_date || '').getFullYear();
  const trailer = item.videos?.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');

  // Filter crew to important roles
  const crew = item.credits?.crew
    .filter(c => ['Director', 'Executive Producer', 'Writer', 'Screenplay', 'Creator'].includes(c.job))
    .reduce((acc, current) => {
        // Deduplicate crew by ID
        const x = acc.find(item => item.id === current.id);
        if (!x) {
          return acc.concat([current]);
        } else {
          return acc;
        }
    }, [] as CrewMember[])
    .slice(0, 6) || [];

  const cast = item.credits?.cast.slice(0, 10) || [];

  // Logic for Letterboxd URL
  // Movies: Use TMDB ID (Native support, most reliable)
  // TV: Use Search (IMDb redirects for TV are flaky/often broken on Letterboxd, creating a bad UX)
  const letterboxdUrl = item.media_type === 'movie'
    ? `https://letterboxd.com/tmdb/${item.id}`
    : `https://letterboxd.com/search/${encodeURIComponent(title || '')}`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#030712] text-slate-200 animate-in fade-in zoom-in-95 duration-300 scrollbar-thin scrollbar-thumb-cyan-900 scrollbar-track-transparent selection:bg-cyan-500/30">
      
      {/* Hero Section */}
      <div className="relative h-[70vh] w-full group overflow-hidden">
        <div className="absolute inset-0">
          <img src={backdropUrl} alt={title} className="w-full h-full object-cover transition duration-[3s] group-hover:scale-105" />
          
          {/* Cyberpunk Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-[#030712]/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#030712] via-[#030712]/80 to-transparent" />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 mix-blend-overlay" />
        </div>

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 z-50 bg-black/40 hover:bg-cyan-500/20 text-white p-2.5 rounded-full backdrop-blur-md border border-white/10 hover:border-cyan-400/50 transition-all duration-300 group/close shadow-[0_0_15px_rgba(0,0,0,0.5)]"
        >
          <X size={24} className="group-hover/close:rotate-90 transition-transform text-slate-300 group-hover/close:text-cyan-400" />
        </button>

        {/* Hero Content */}
        <div className="absolute bottom-0 left-0 w-full p-8 md:p-12 z-20 pt-32">
          <div className="max-w-5xl">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-3 mb-4 animate-in slide-in-from-left-4 duration-500 delay-100">
               <span className="bg-cyan-500/20 backdrop-blur-md text-cyan-300 px-3 py-1 rounded-lg text-xs font-bold border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
                  {item.status}
               </span>
               <span className="flex items-center gap-1.5 bg-yellow-500/10 backdrop-blur-md text-yellow-400 px-3 py-1 rounded-lg text-xs font-bold border border-yellow-500/20">
                  <Star size={12} fill="currentColor" /> {item.vote_average?.toFixed(1)}
               </span>
               {item.genres?.map(g => (
                 <span key={g.id} className="bg-white/5 backdrop-blur-md text-slate-300 px-3 py-1 rounded-lg text-xs font-medium border border-white/5">
                   {g.name}
                 </span>
               ))}
            </div>

            <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-500 mb-6 drop-shadow-2xl animate-in slide-in-from-left-4 duration-500 delay-200 leading-tight">
              {title}
            </h1>

            <div className="flex flex-wrap items-center gap-6 text-slate-400 text-sm font-medium mb-8 animate-in slide-in-from-left-4 duration-500 delay-300">
               {year && <span className="flex items-center gap-2"><Calendar size={16} className="text-cyan-500"/> {year}</span>}
               {item.runtime ? (
                 <span className="flex items-center gap-2"><Clock size={16} className="text-purple-500"/> {Math.floor(item.runtime / 60)}h {item.runtime % 60}m</span>
               ) : (
                 item.number_of_seasons && <span className="flex items-center gap-2"><Clock size={16} className="text-purple-500"/> {item.number_of_seasons} Seasons</span>
               )}
            </div>

            <div className="flex flex-wrap items-center gap-4 animate-in slide-in-from-bottom-4 duration-500 delay-400">
              {trailer && (
                 <a 
                   href={`https://www.youtube.com/watch?v=${trailer.key}`} 
                   target="_blank" 
                   rel="noreferrer"
                   className="bg-cyan-600 hover:bg-cyan-500 text-white px-8 py-3.5 rounded-xl font-bold flex items-center gap-3 transition-all hover:scale-105 shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                 >
                   <Play size={20} fill="currentColor" /> Watch Trailer
                 </a>
              )}
              
              <button 
                onClick={() => onToggleFavorite(item)}
                className={`px-6 py-3.5 rounded-xl font-bold flex items-center gap-3 transition-all border backdrop-blur-md hover:scale-105 ${
                  isFavorite 
                    ? 'bg-pink-500/20 border-pink-500 text-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.3)]' 
                    : 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <HeartIcon filled={isFavorite} />
                {isFavorite ? 'Favorited' : 'Favorite'}
              </button>

              <button 
                onClick={() => onToggleWatchlist(item)}
                className={`px-6 py-3.5 rounded-xl font-bold flex items-center gap-3 transition-all border backdrop-blur-md hover:scale-105 ${
                  isWatchlist 
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                    : 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20'
                }`}
              >
                {isWatchlist ? <Check size={20} /> : <Plus size={20} />}
                {isWatchlist ? 'On Watchlist' : 'Watchlist'}
              </button>

              <a 
                href={letterboxdUrl} 
                target="_blank" 
                rel="noreferrer"
                className="bg-[#202830]/80 hover:bg-[#2c3440] text-slate-200 px-6 py-3.5 rounded-xl font-bold flex items-center gap-3 transition-all hover:scale-105 border border-white/5 hover:border-white/10 backdrop-blur-md"
              >
                <ExternalLink size={20} /> Letterboxd
              </a>

            </div>

            {/* User Rating Section */}
            <div className="mt-6 animate-in slide-in-from-bottom-4 duration-500 delay-500">
              <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-xl p-4 inline-block">
                <p className="text-sm text-slate-400 mb-2 font-medium">Your Rating:</p>
                <StarRating
                  value={userRatings[`${item.media_type}-${item.id}`] || 0}
                  onChange={(rating) => onRate(`${item.media_type}-${item.id}`, rating)}
                  size={24}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 pb-20 -mt-10 relative z-30">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
           
           {/* Left Column: Info & Cast */}
           <div className="lg:col-span-2 space-y-12">
              
              {/* Tagline & Overview */}
              <div className="bg-[#0b1221]/80 backdrop-blur-xl border border-white/5 p-8 rounded-3xl shadow-xl">
                 {item.tagline && (
                    <h3 className="text-xl md:text-2xl font-light italic text-cyan-200/80 mb-4 font-serif">"{item.tagline}"</h3>
                 )}
                 <p className="text-slate-300 leading-8 text-lg font-light">{item.overview}</p>
              </div>

              {/* Cast Grid */}
              <section>
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                    <span className="w-1 h-6 bg-cyan-500 rounded-full shadow-[0_0_10px_#06b6d4]"></span> 
                    Top Cast
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {cast.map(person => (
                        <div 
                            key={person.id} 
                            onClick={() => onCastClick(person.id)}
                            className="group bg-[#0f172a] rounded-xl p-3 border border-white/5 hover:border-cyan-500/50 hover:bg-[#162032] transition-all cursor-pointer flex items-center gap-3"
                        >
                            <img 
                                src={person.profile_path ? `https://image.tmdb.org/t/p/w200${person.profile_path}` : 'https://via.placeholder.com/200'}
                                alt={person.name}
                                className="w-12 h-12 rounded-full object-cover ring-2 ring-white/10 group-hover:ring-cyan-500 transition-all"
                            />
                            <div className="overflow-hidden">
                                <p className="text-slate-200 font-bold text-sm truncate group-hover:text-cyan-400 transition-colors">{person.name}</p>
                                <p className="text-slate-500 text-xs truncate">{person.character}</p>
                            </div>
                        </div>
                    ))}
                </div>
              </section>
              
              {/* Crew Grid */}
              {crew.length > 0 && (
                <section>
                    <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                        <span className="w-1 h-6 bg-purple-500 rounded-full shadow-[0_0_10px_#a855f7]"></span> 
                        Creative Team
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {crew.map(person => (
                            <div 
                                key={`crew-${person.id}-${person.job}`}
                                onClick={() => onCastClick(person.id)}
                                className="group bg-[#0f172a] rounded-xl p-3 border border-white/5 hover:border-purple-500/50 hover:bg-[#162032] transition-all cursor-pointer"
                            >
                                <p className="text-slate-200 font-bold text-sm truncate group-hover:text-purple-400 transition-colors">{person.name}</p>
                                <p className="text-slate-500 text-xs truncate">{person.job}</p>
                            </div>
                        ))}
                    </div>
                </section>
              )}
           </div>

           {/* Right Column: TV Stats */}
           <div className="lg:col-span-1 space-y-8">
              {item.media_type === 'tv' && item.seasons && (
                  <div className="bg-[#0b1221]/80 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-xl sticky top-24">
                      
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                           <MonitorPlay className="text-cyan-400" size={20} /> Season {selectedSeason}
                        </h3>
                        <div className="relative">
                            <select 
                                value={selectedSeason}
                                onChange={(e) => setSelectedSeason(Number(e.target.value))}
                                className="bg-slate-900 text-white border border-slate-700 rounded-lg py-2 pl-3 pr-8 appearance-none focus:border-cyan-500 focus:outline-none cursor-pointer text-sm font-bold"
                            >
                                {item.seasons.filter(s => s.season_number > 0).map(s => (
                                    <option key={s.id} value={s.season_number}>
                                        Season {s.season_number} ({s.episode_count} eps)
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-2.5 text-slate-400 pointer-events-none" size={16} />
                        </div>
                      </div>

                      {/* Bar Chart */}
                      <div className="h-48 w-full mb-6">
                         {loadingEpisodes ? (
                             <div className="h-full flex items-center justify-center">
                                 <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                             </div>
                         ) : episodes.length > 0 ? (
                             <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={episodes}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                                    <XAxis dataKey="episode_number" hide />
                                    <YAxis domain={[0, 10]} hide />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                                        itemStyle={{ color: '#22d3ee' }}
                                        cursor={{ fill: '#334155', opacity: 0.4 }}
                                        formatter={(value: number) => [value.toFixed(1), 'Rating']}
                                        labelFormatter={(label) => `Episode ${label}`}
                                    />
                                    <Bar dataKey="vote_average" radius={[4, 4, 0, 0]}>
                                        {episodes.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill="url(#colorGradient)" />
                                        ))}
                                    </Bar>
                                    <defs>
                                        <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                        </linearGradient>
                                    </defs>
                                </BarChart>
                             </ResponsiveContainer>
                         ) : (
                             <div className="text-center text-slate-500 text-sm py-10">No rating data available</div>
                         )}
                      </div>

                      {/* Episode List */}
                      <div className="space-y-3 max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 pr-2">
                          {episodes.map(ep => {
                              const episodeKey = `tv-${item.id}-s${ep.season_number}e${ep.episode_number}`;
                              return (
                              <div key={ep.id} className="bg-slate-900/50 p-3 rounded-xl border border-white/5 group hover:border-cyan-500/30 transition-all">
                                  <div className="flex gap-3 mb-2">
                                      <div className="w-24 aspect-video bg-slate-800 rounded-lg overflow-hidden shrink-0 relative">
                                          {ep.still_path ? (
                                              <img src={`https://image.tmdb.org/t/p/w200${ep.still_path}`} alt={ep.name} className="w-full h-full object-cover" />
                                          ) : (
                                              <div className="w-full h-full flex items-center justify-center text-slate-600"><Film size={16} /></div>
                                          )}
                                          <div className="absolute top-1 right-1 bg-black/60 text-[10px] text-white px-1.5 rounded font-bold backdrop-blur-sm">
                                              {ep.vote_average.toFixed(1)}
                                          </div>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                          <div className="flex justify-between items-start">
                                              <h4 className="text-slate-200 font-bold text-sm truncate group-hover:text-cyan-400 transition-colors">{ep.episode_number}. {ep.name}</h4>
                                          </div>
                                          <p className="text-slate-500 text-xs mt-1 line-clamp-2">{ep.overview}</p>
                                          <div className="text-slate-600 text-[10px] mt-2 font-mono">
                                              {ep.air_date}
                                          </div>
                                      </div>
                                  </div>
                                  {/* Episode Rating */}
                                  <div className="mt-2 pt-2 border-t border-white/5">
                                      <StarRating
                                          value={userRatings[episodeKey] || 0}
                                          onChange={(rating) => onRate(episodeKey, rating)}
                                          size={14}
                                      />
                                  </div>
                              </div>
                          )})}
                      </div>

                  </div>
              )}
           </div>

        </div>
      </div>
    </div>
  );
};

// Helper for heart icon
const HeartIcon = ({ filled }: { filled: boolean }) => (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="20" 
      height="20" 
      viewBox="0 0 24 24" 
      fill={filled ? "currentColor" : "none"} 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
);

export default DetailView;