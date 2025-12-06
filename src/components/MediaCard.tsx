import React from 'react';
import { Star, Tv, Film, Calendar } from 'lucide-react';
import { MediaItem } from '../types';

interface MediaCardProps {
  item: MediaItem;
  onClick: (item: MediaItem) => void;
  // optional ranking number (1, 2, 3...) – only passed on ranked searches
  rank?: number | null;
  showRank?: boolean;
}

const MediaCard: React.FC<MediaCardProps> = ({ item, onClick, rank, showRank = false }) => {
  const imageUrl = item.poster_path
    ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
    : item.still_path
      ? `https://image.tmdb.org/t/p/w500${item.still_path}` // Fallback for episodes
      : 'https://picsum.photos/300/450'; // Fallback placeholder

  const title = item.title || item.name;
  const date = item.release_date || item.first_air_date || item.air_date; // Handle episodes too
  const year = date ? new Date(date).getFullYear() : 'N/A';
  const isEpisode = !!item.episode_number;

  const rating = item.vote_average ? item.vote_average.toFixed(1) : null;

  return (
    <div
      onClick={() => onClick(item)}
      className="group relative bg-[#0a0f1e] rounded-2xl cursor-pointer transition-all duration-500 transform hover:-translate-y-2 hover:z-10"
    >
      {/* Rank badge (for ranked search results) */}
      {showRank && rank != null && (
        <div className="absolute top-2 left-2 z-30 bg-cyan-400/95 text-slate-950 text-xs font-extrabold px-2.5 py-1 rounded-full shadow-[0_0_16px_rgba(34,211,238,0.65)] flex items-center gap-1">
          <span className="text-[10px] opacity-80">#</span>
          <span className="text-sm leading-none">{rank}</span>
        </div>
      )}

      {/* Image Container (handles clipping) */}
      <div
        className={`relative overflow-hidden rounded-2xl ${
          isEpisode ? 'aspect-video' : 'aspect-[2/3]'
        }`}
      >
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 group-hover:contrast-110"
          loading="lazy"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent opacity-80 group-hover:opacity-60 transition-opacity duration-300" />

        {/* Rating Badge – always visible */}
        {rating && (
          <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md text-cyan-300 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.4)]">
            <Star size={12} fill="currentColor" />
            {rating}
          </div>
        )}

        {/* Type Badge (Movie / TV) */}
        <div className="absolute top-2 right-2 bg-fuchsia-600/95 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 border border-fuchsia-400/40 shadow-[0_0_12px_rgba(236,72,153,0.5)]">
          {item.media_type === 'tv' ? <Tv size={12} /> : <Film size={12} />}
          <span className="uppercase tracking-wider">{item.media_type}</span>
        </div>
      </div>

      {/* Content Info */}
      <div className="p-4 relative z-10 bg-gradient-to-b from-transparent to-[#050b1a] rounded-b-2xl">
        <h3 className="text-slate-100 font-bold text-sm truncate group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-cyan-400 group-hover:to-fuchsia-400 transition-all">
          {title}
        </h3>
        <div className="flex justify-between items-center mt-2 text-slate-500 text-xs font-medium">
          <span className="flex items-center gap-1.5 group-hover:text-slate-300 transition-colors">
            <Calendar
              size={14}
              className="text-slate-600 group-hover:text-cyan-500 transition-colors"
            />
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