import React from 'react';
import { X, Calendar, MapPin, Award, Star, ExternalLink } from 'lucide-react';
import { PersonDetail, MediaItem } from '../types';
import MediaCard from './MediaCard';

interface PersonViewProps {
  person: PersonDetail;
  onClose: () => void;
  onMediaClick: (item: MediaItem) => void;
}

const PersonView: React.FC<PersonViewProps> = ({ person, onClose, onMediaClick }) => {
  const profileUrl = person.profile_path 
    ? `https://image.tmdb.org/t/p/h632${person.profile_path}` 
    : 'https://picsum.photos/400/600';

  // Combine Cast and Crew, remove duplicates by ID
  const allCredits = [...person.combined_credits.cast, ...person.combined_credits.crew];
  
  // Dedup logic
  const uniqueCreditsMap = new Map();
  allCredits.forEach(item => {
      if (!item.poster_path) return; // Skip items without posters
      if (!uniqueCreditsMap.has(item.id)) {
          uniqueCreditsMap.set(item.id, item);
      }
  });

  const knownFor = Array.from(uniqueCreditsMap.values())
    .sort((a, b) => b.vote_count - a.vote_count) // Sort by popularity
    .slice(0, 24);

  // Prefer TMDB Person ID as it is the native identifier for Letterboxd data source
  const letterboxdUrl = `https://letterboxd.com/tmdb/person/${person.id}`;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#020617] text-slate-200 animate-in fade-in duration-300 scrollbar-thin scrollbar-thumb-purple-900 scrollbar-track-transparent">
      
      {/* Background Grid */}
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-6 py-12 relative">
        
        <button 
          onClick={onClose}
          className="fixed top-6 right-6 bg-black/50 hover:bg-white/10 p-2.5 rounded-full text-white backdrop-blur-md border border-white/10 hover:border-purple-500/50 transition z-50 group shadow-[0_0_15px_rgba(0,0,0,0.5)]"
        >
          <X size={24} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12 mt-8">
            
            {/* Left Col: Profile */}
            <div className="lg:col-span-1 space-y-8">
                {/* Profile Image with Neon Glow */}
                <div className="rounded-2xl overflow-hidden shadow-2xl relative group ring-1 ring-white/10 hover:ring-purple-500/50 transition-all duration-500">
                    <img src={profileUrl} alt={person.name} className="w-full h-auto object-cover transition duration-700 group-hover:scale-105" />
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-80" />
                    <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black to-transparent">
                        <h2 className="text-3xl font-black text-white mb-1 leading-tight">{person.name}</h2>
                        <div className="text-purple-400 text-sm font-bold uppercase tracking-wider flex flex-wrap gap-2">
                            {person.combined_credits.cast.length > 0 && <span>Actor</span>}
                            {person.combined_credits.cast.length > 0 && person.combined_credits.crew.length > 0 && <span className="text-slate-600">•</span>}
                            {person.combined_credits.crew.length > 0 && <span>Crew</span>}
                        </div>
                    </div>
                </div>
                
                {/* Stats Box */}
                <div className="bg-[#0f172a]/80 backdrop-blur-md p-6 rounded-2xl border border-white/5 space-y-5 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-500 to-cyan-500"></div>
                    
                    {person.birthday && (
                        <div className="flex items-center gap-3 text-slate-400 text-sm group">
                            <div className="bg-slate-800 p-2.5 rounded-xl text-slate-300 group-hover:text-purple-400 group-hover:bg-purple-500/10 transition-colors"><Calendar size={18} /></div>
                            <div>
                                <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold">Born</span>
                                <span className="text-white font-medium">{person.birthday}</span>
                            </div>
                        </div>
                    )}
                    {person.place_of_birth && (
                        <div className="flex items-center gap-3 text-slate-400 text-sm group">
                             <div className="bg-slate-800 p-2.5 rounded-xl text-slate-300 group-hover:text-cyan-400 group-hover:bg-cyan-500/10 transition-colors"><MapPin size={18} /></div>
                             <div>
                                <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold">Place of Birth</span>
                                <span className="text-white font-medium">{person.place_of_birth}</span>
                             </div>
                        </div>
                    )}
                    <div className="flex items-center gap-3 text-slate-400 text-sm group">
                         <div className="bg-slate-800 p-2.5 rounded-xl text-slate-300 group-hover:text-yellow-400 group-hover:bg-yellow-500/10 transition-colors"><Award size={18} /></div>
                         <div>
                            <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold">Total Credits</span>
                            <span className="text-white font-medium">{person.combined_credits.cast.length + person.combined_credits.crew.length} Titles</span>
                         </div>
                    </div>
                    
                    <a 
                      href={letterboxdUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 text-slate-400 text-sm group cursor-pointer hover:bg-white/5 p-2 -mx-2 rounded-lg transition-colors"
                    >
                         <div className="bg-slate-800 p-2.5 rounded-xl text-slate-300 group-hover:text-green-400 group-hover:bg-green-500/10 transition-colors"><ExternalLink size={18} /></div>
                         <div>
                            <span className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold">View On</span>
                            <span className="text-white font-medium group-hover:text-green-400 transition-colors">Letterboxd</span>
                         </div>
                    </a>
                </div>
            </div>

            {/* Right Col: Bio & Credits */}
            <div className="lg:col-span-3 space-y-12">
                
                {/* Biography */}
                <section className="bg-[#0f172a]/50 backdrop-blur-sm p-8 rounded-3xl border border-white/5 relative">
                     <div className="absolute -top-3 -left-3">
                         <Star className="text-purple-500 fill-purple-500 animate-pulse" size={24} />
                     </div>
                    <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                        Biography
                    </h3>
                    <p className="text-lg text-slate-300 leading-relaxed font-light whitespace-pre-line">
                        {person.biography || "No biography available for this person."}
                    </p>
                </section>

                {/* Filmography */}
                <section>
                    <h3 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
                        <span className="w-1 h-8 bg-gradient-to-b from-cyan-500 to-purple-600 rounded-full"></span>
                        Known For
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-6">
                        {knownFor.map(item => (
                            <MediaCard key={`${item.id}-${item.media_type}`} item={item} onClick={onMediaClick} />
                        ))}
                    </div>
                </section>
            </div>
        </div>
      </div>
    </div>
  );
};

export default PersonView;