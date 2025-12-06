import React from 'react';
import { Star, Tv, Film, Calendar } from 'lucide-react';
import { MediaItem } from '../types';

interface MediaCardProps {
  item: MediaItem;
  onClick: (item: MediaItem) => void;
  /** Optional rank for search results (#1, #2, ...). */
  rank?: number;
}

const MediaCard: React.FC<MediaCardProps> = ({ item, onClick, rank }) => {
  const imageUrl = item.poster_path
    ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
    : item.still_path
      ? `https://image.tmdb.org/t/p/w500${item.still_path}` // Fallback for episodes
      : 'https://picsum.photos/300/450'; // Fallback placeholder

  const title = item.title || item.name;
  const date = item.release_date || item.first_air_date || item.air_date; // episodes too
  const year = date ? new Date(date).getFullYear() : 'N/A';
  const isEpisode = !!item.episode_number;

  const rating = item.vote_average
    ? Number(item.vote_average.toFixed(1))
    : null;

  return (
    <div
      onClick={() => onClick(item)}
      className="group relative bg-[#0a0f1e] rounded-2xl overflow-hidden cursor-pointer transition-all duration-500 transform hover:-translate-y-2 hover:z-10"
    >
      {/* Glow border */}
      <div className="absolute inset-0 rounded-2xl border border-white/5 group-hover:border-cyan-500/50 group-hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all duration-500 pointer-events-none z-10" />

      {/* Image */}
      <div
        className={`relative overflow-hidden ${
          isEpisode ? 'aspect-video' : 'aspect-[2/3]'
        }`}
      >
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 group-hover:contrast-110"
          loading="lazy"
        />

        {/* dark gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent opacity-80 group-hover:opacity-60 transition-opacity duration-300" />

        {/* RANK BADGE – always fully inside card */}
        {typeof rank === 'number' && (
          <div className="absolute top-2 left-2 z-20 bg-cyan-500 text-xs font-extrabold text-slate-950 px-2.5 py-1 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.5)] border border-cyan-200/70">
            #{rank}
          </div>
        )}

        {/* TYPE BADGE */}
        <div className="absolute top-2 right-2 z-20 bg-fuchsia-600/95 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 border border-fuchsia-300/50 shadow-[0_0_10px_rgba(236,72,153,0.4)]">
          {item.media_type === 'tv' ? <Tv size={12} /> : <Film size={12} />}
          <span className="uppercase tracking-wider">
            {item.media_type === 'tv' ? 'TV' : 'Movie'}
          </span>
        </div>

        {/* RATING BADGE – ALWAYS VISIBLE */}
        {rating !== null && (
          <div className="absolute bottom-2 left-2 z-20 bg-black/80 backdrop-blur-md text-cyan-300 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.45)]">
            <Star size={12} fill="currentColor" />
            <span>{rating}</span>
          </div>
        )}

        {/* EPISODE S/E BADGE */}
        {isEpisode && (
          <div className="absolute bottom-2 right-2 z-20 text-[10px] font-bold text-cyan-100 bg-cyan-600/80 px-2.5 py-1 rounded-full border border-cyan-300/60 shadow-[0_0_10px_rgba(6,182,212,0.5)]">
            S{item.season_number} E{item.episode_number}
          </div>
        )}
      </div>

      {/* TEXT CONTENT */}
      <div className="p-4 relative z-0 bg-gradient-to-b from-transparent to-[#050b1a]">
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
            <span className="text-slate-400 text-[10px]">
              Episode • {rating !== null ? `${rating}/10` : 'NR'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaCard;