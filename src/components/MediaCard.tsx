import React from 'react';
import { Star, Tv, Film, Calendar } from 'lucide-react';
import { MediaItem } from '../types';

interface MediaCardProps {
  item: MediaItem;
  onClick: (item: MediaItem) => void;
}

const MediaCard: React.FC<MediaCardProps> = ({ item, onClick }) => {
  const imageUrl = item.poster_path 
    ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
    : item.still_path 
      ? `https://image.tmdb.org/t/p/w500${item.still_path}` // Fallback for episodes
      : 'https://picsum.photos/300/450'; // Fallback placeholder

  const title = item.title || item.name;
  const date = item.release_date || item.first_air_date || item.air_date; // Handle episodes too
  const year = date ? new Date(date).getFullYear() : 'N/A';
  const isEpisode = !!item.episode_number;

  return (
    <div 
      onClick={() => onClick(item)}
      className="group relative bg-[#0a0f1e] rounded-2xl overflow-hidden cursor-pointer transition-all duration-500 transform hover:-translate-y-2 hover:z-10"
    >
      {/* Cyberpunk Glow Border on Hover */}
      <div className="absolute inset-0 rounded-2xl border border-white/5 group-hover:border-cyan-500/50 group-hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all duration-500 pointer-events-none z-20" />

      {/* Image Container */}
      <div className={`relative overflow-hidden ${isEpisode ? 'aspect-video' : 'aspect-[2/3]'}`}>
        <img 
          src={imageUrl} 
          alt={title} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 group-hover:contrast-110"
          loading="lazy"
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent opacity-80 group-hover:opacity-60 transition-opacity duration-300" />

        {/* Rating Badge - Floating Neon */}
        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-cyan-300 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.2)] translate-y-[-10px] opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 delay-100">
          <Star size={12} fill="currentColor" />
          {item.vote_average?.toFixed(1)}
        </div>

        {/* Type Badge */}
        <div className="absolute top-3 left-3 bg-fuchsia-600/90 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 border border-fuchsia-400/30 shadow-[0_0_10px_rgba(236,72,153,0.3)] translate-y-[-10px] opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
          {item.media_type === 'tv' ? <Tv size={12} /> : <Film size={12} />}
          <span className="uppercase tracking-wider">{item.media_type}</span>
        </div>
      </div>

      {/* Content Info */}
      <div className="p-4 relative z-10 bg-gradient-to-b from-transparent to-[#050b1a]">
        <h3 className="text-slate-100 font-bold text-sm truncate group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-cyan-400 group-hover:to-fuchsia-400 transition-all">
            {title}
        </h3>
        <div className="flex justify-between items-center mt-2 text-slate-500 text-xs font-medium">
            <span className="flex items-center gap-1.5 group-hover:text-slate-300 transition-colors">
                <Calendar size={14} className="text-slate-600 group-hover:text-cyan-500 transition-colors" />
                {year}
            </span>
            {isEpisode && (
                <span className="text-cyan-400 bg-cyan-950/30 px-2 py-0.5 rounded border border-cyan-500/30 shadow-[0_0_8px_rgba(6,182,212,0.15)]">
                    S{item.season_number} E{item.episode_number}
                </span>
            )}
        </div>
      </div>
    </div>
  );
};

export default MediaCard;