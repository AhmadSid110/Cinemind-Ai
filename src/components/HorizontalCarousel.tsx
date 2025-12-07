// src/components/HorizontalCarousel.tsx
import React from 'react';
import { MediaItem } from '../types';
import MediaCard from './MediaCard';

interface HorizontalCarouselProps {
  title: string;
  items: MediaItem[];
  onItemClick: (item: MediaItem) => void;
  accentColor?: string;
  emptyMessage?: string;
}

/**
 * Horizontal scrollable carousel for displaying media items.
 * Used in the home page for sections like "Trending Movies", "In Theatres", etc.
 */
const HorizontalCarousel: React.FC<HorizontalCarouselProps> = ({
  title,
  items,
  onItemClick,
  accentColor = 'cyan',
  emptyMessage = 'No items available right now.',
}) => {
  const colorClasses = {
    cyan: 'bg-cyan-500',
    fuchsia: 'bg-fuchsia-500',
    emerald: 'bg-emerald-500',
    indigo: 'bg-indigo-500',
    pink: 'bg-pink-500',
    amber: 'bg-amber-500',
  };

  const accentClass = colorClasses[accentColor as keyof typeof colorClasses] || colorClasses.cyan;

  return (
    <section className="mb-10">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <span className={`w-2 h-8 ${accentClass} rounded-full`} />
          {title}
        </h2>
      </div>

      {/* Carousel Content */}
      {items.length > 0 ? (
        <div className="relative -mx-4 px-4">
          {/* Horizontal scroll container */}
          <div className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-4 scroll-smooth">
            {items.slice(0, 20).map((item) => (
              <div
                key={item.id}
                className="flex-shrink-0 w-[160px] sm:w-[180px] md:w-[200px] snap-start"
              >
                <MediaCard item={item} onClick={onItemClick} />
              </div>
            ))}
          </div>

          {/* Scroll fade indicators */}
          <div className="absolute left-0 top-0 bottom-4 w-8 bg-gradient-to-r from-[#020617] to-transparent pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-4 w-8 bg-gradient-to-l from-[#020617] to-transparent pointer-events-none" />
        </div>
      ) : (
        <p className="text-slate-500 text-sm">{emptyMessage}</p>
      )}
    </section>
  );
};

export default HorizontalCarousel;
