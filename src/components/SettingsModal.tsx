// src/components/SettingsModal.tsx
import React, { useState, useEffect } from 'react';
import { Key, Save, AlertTriangle, Sparkles, Cloud, Film, Tv, Star } from 'lucide-react';
import { validateKey } from '../services/tmdbService';

interface SettingsModalProps {
  currentKey: string;
  currentGeminiKey: string;
  currentOpenAIKey: string;
  currentOmdbKey: string;
  useOmdbRatings: boolean;
  // NEW toggles (current values passed from App)
  currentShowEpisodeImdbOnCards: boolean;
  currentShowEpisodeImdbOnSeasonList: boolean;
  currentCloudSync?: boolean;
  currentRankEpisodesByImdb: boolean;

  /**
   * onSave's signature extended:
   * onSave(tmdbKey, geminiKey, openaiKey, omdbKey, useOmdbRatings, showEpisodeImdbOnCards, showEpisodeImdbOnSeasonList, enableCloudSync, rankEpisodesByImdb)
   */
  onSave: (
    tmdbKey: string,
    geminiKey: string,
    openaiKey: string,
    omdbKey: string,
    useOmdbRatings: boolean,
    showEpisodeImdbOnCards: boolean,
    showEpisodeImdbOnSeasonList: boolean,
    enableCloudSync: boolean,
    rankEpisodesByImdb: boolean
  ) => void;
  onClose: () => void;
  isOpen: boolean;
}

const SmallToggle: React.FC<{
  value: boolean;
  onChange: (v: boolean) => void;
  ariaLabel?: string;
}> = ({ value, onChange, ariaLabel }) => (
  <button
    type="button"
    aria-pressed={value}
    aria-label={ariaLabel}
    onClick={() => onChange(!value)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
      value ? 'bg-amber-500' : 'bg-slate-700'
    }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        value ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

const SectionHeader: React.FC<{ title: string; subtitle?: string; icon?: React.ReactNode }> = ({ title, subtitle, icon }) => (
  <div className="mb-3">
    <div className="flex items-center gap-3">
      <div className="text-cyan-400">{icon}</div>
      <div>
        <div className="text-sm font-semibold text-slate-200">{title}</div>
        {subtitle && <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>}
      </div>
    </div>
  </div>
);

const SettingsModal: React.FC<SettingsModalProps> = ({
  currentKey,
  currentGeminiKey,
  currentOpenAIKey,
  currentOmdbKey,
  useOmdbRatings,
  currentShowEpisodeImdbOnCards,
  currentShowEpisodeImdbOnSeasonList,
  currentCloudSync,
  currentRankEpisodesByImdb,
  onSave,
  onClose,
  isOpen,
}) => {
  // Local input state, initialized from props…
  const [keyInput, setKeyInput] = useState(currentKey || '');
  const [geminiKeyInput, setGeminiKeyInput] = useState(currentGeminiKey || '');
  const [openaiKeyInput, setOpenaiKeyInput] = useState(currentOpenAIKey || '');
  const [omdbKeyInput, setOmdbKeyInput] = useState(currentOmdbKey || '');
  const [useOmdbToggle, setUseOmdbToggle] = useState(useOmdbRatings);
  // NEW toggles local state
  const [showEpisodeImdbOnCards, setShowEpisodeImdbOnCards] = useState<boolean>(currentShowEpisodeImdbOnCards);
  const [showEpisodeImdbOnSeasonList, setShowEpisodeImdbOnSeasonList] = useState<boolean>(currentShowEpisodeImdbOnSeasonList);
  const [enableCloudSync, setEnableCloudSync] = useState<boolean>(!!currentCloudSync);
  const [rankEpisodesByImdb, setRankEpisodesByImdb] = useState<boolean>(currentRankEpisodesByImdb);

  const [status, setStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');

  // …and kept in sync if props change (e.g. when Firebase finishes loading)
  useEffect(() => { setKeyInput(currentKey || ''); }, [currentKey]);
  useEffect(() => { setGeminiKeyInput(currentGeminiKey || ''); }, [currentGeminiKey]);
  useEffect(() => { setOpenaiKeyInput(currentOpenAIKey || ''); }, [currentOpenAIKey]);
  useEffect(() => { setOmdbKeyInput(currentOmdbKey || ''); }, [currentOmdbKey]);
  useEffect(() => { setUseOmdbToggle(useOmdbRatings); }, [useOmdbRatings]);
  useEffect(() => { setShowEpisodeImdbOnCards(currentShowEpisodeImdbOnCards); }, [currentShowEpisodeImdbOnCards]);
  useEffect(() => { setShowEpisodeImdbOnSeasonList(currentShowEpisodeImdbOnSeasonList); }, [currentShowEpisodeImdbOnSeasonList]);
  useEffect(() => { setEnableCloudSync(!!currentCloudSync); }, [currentCloudSync]);
  useEffect(() => { setRankEpisodesByImdb(currentRankEpisodesByImdb); }, [currentRankEpisodesByImdb]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const trimmedTmdb = keyInput.trim();
    const trimmedGemini = geminiKeyInput.trim();
    const trimmedOpenAI = openaiKeyInput.trim();
    const trimmedOmdb = omdbKeyInput.trim();

    if (!trimmedTmdb) {
      setStatus('invalid');
      return;
    }

    setStatus('checking');

    try {
      const isValid = await validateKey(trimmedTmdb);

      if (isValid) {
        setStatus('valid');
        // Let parent (App.tsx) update state + persist
        onSave(
          trimmedTmdb,
          trimmedGemini,
          trimmedOpenAI,
          trimmedOmdb,
          useOmdbToggle,
          showEpisodeImdbOnCards,
          showEpisodeImdbOnSeasonList,
          enableCloudSync,
          rankEpisodesByImdb
        );

        // Close after a short success flash
        setTimeout(() => {
          setStatus('idle');
          onClose();
        }, 500);
      } else {
        setStatus('invalid');
      }
    } catch (err) {
      console.error('Error validating TMDB key:', err);
      setStatus('invalid');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-cyan-800/20">
              <Key size={28} className="text-cyan-300" />
            </div>
            <div>
              <div className="text-lg font-bold text-white">App Configuration</div>
              <div className="text-xs text-slate-500">Manage API keys & rating options</div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-xs text-slate-400">Version</div>
            <div className="text-xs font-mono text-slate-300">v1</div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left column - Keys */}
            <div className="space-y-6">
              <SectionHeader title="TMDB (Required)" subtitle="Needed for movie/show metadata" icon={<Film />} />
              <div>
                <input
                  type="text"
                  value={keyInput}
                  onChange={(e) => { setKeyInput(e.target.value); setStatus('idle'); }}
                  placeholder="TMDB API Key (v3)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-cyan-500 transition font-mono text-sm"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Get it from{' '}
                  <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">
                    TMDB Settings
                  </a>.
                </p>
              </div>

              <SectionHeader title="AI Keys (Optional)" subtitle="Optional keys for Natural Language search / AI features" icon={<Sparkles />} />
              <div className="space-y-3">
                <input
                  type="text"
                  value={geminiKeyInput}
                  onChange={(e) => setGeminiKeyInput(e.target.value)}
                  placeholder="Google Gemini API Key (optional)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-purple-500 transition font-mono text-sm"
                />
                <input
                  type="text"
                  value={openaiKeyInput}
                  onChange={(e) => setOpenaiKeyInput(e.target.value)}
                  placeholder="OpenAI API Key (optional)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-emerald-500 transition font-mono text-sm"
                />
              </div>
            </div>

            {/* Right column - Ratings / Toggles */}
            <div className="space-y-6">
              <SectionHeader title="OMDb / Ratings" subtitle="IMDb, Metacritic & Rotten Tomatoes via OMDb" icon={<Star />} />
              <div className="space-y-3">
                <input
                  type="text"
                  value={omdbKeyInput}
                  onChange={(e) => setOmdbKeyInput(e.target.value)}
                  placeholder="OMDb API Key (optional)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-amber-500 transition font-mono text-sm"
                />
                <p className="text-xs text-slate-500">
                  Get an API key from{' '}
                  <a href="https://www.omdbapi.com/apikey.aspx" target="_blank" rel="noreferrer" className="text-amber-400 hover:underline">
                    OMDb API
                  </a>.
                </p>

                <div className="flex items-center justify-between mt-2">
                  <div>
                    <div className="text-sm font-medium text-slate-200">Use OMDb Ratings</div>
                    <div className="text-xs text-slate-500">Prefer IMDb/RT/Metacritic where available</div>
                  </div>
                  <SmallToggle value={useOmdbToggle} onChange={setUseOmdbToggle} ariaLabel="Toggle OMDb ratings" />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <div className="text-sm font-semibold text-slate-200 mb-2">Episode Rating Display</div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-200">Show episode IMDb on cards</div>
                      <div className="text-xs text-slate-500">Display episode-level IMDb rating on home / search cards for episode results</div>
                    </div>
                    <SmallToggle value={showEpisodeImdbOnCards} onChange={setShowEpisodeImdbOnCards} ariaLabel="Show episode imdb on cards" />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-200">Show episode IMDb in season lists</div>
                      <div className="text-xs text-slate-500">Replace TMDB episode rating with episode IMDb in the season episode list (Details page)</div>
                    </div>
                    <SmallToggle value={showEpisodeImdbOnSeasonList} onChange={setShowEpisodeImdbOnSeasonList} ariaLabel="Show episode imdb in season list" />
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                    <div>
                      <div className="text-sm font-medium text-slate-200">Rank episodes by IMDb rating</div>
                      <div className="text-xs text-slate-500">When searching "top episodes", sort using IMDb rating instead of TMDB (if available)</div>
                    </div>
                    <SmallToggle value={rankEpisodesByImdb} onChange={setRankEpisodesByImdb} ariaLabel="Rank episodes by IMDb rating" />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-200 flex items-center gap-2">
                      <Cloud /> <span>Sync ratings across devices</span>
                    </div>
                    <div className="text-xs text-slate-500">Upload OMDb cache to your Firestore account (opt-in)</div>
                  </div>
                  <SmallToggle value={enableCloudSync} onChange={setEnableCloudSync} ariaLabel="Enable cloud sync" />
                </div>
              </div>
            </div>
          </div>

          {/* advanced / status area */}
          <div className="mt-6">
            <div className="text-xs text-slate-400 mb-2">Advanced</div>
            <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-3 text-xs text-slate-300">
              <div className="flex items-center gap-3">
                <Tv className="text-fuchsia-400" />
                <div>
                  <div className="font-medium">Note</div>
                  <div className="text-slate-500 text-[13px]">
                    TMDB API has rate limits — enabling OMDb may increase network calls. Cloud sync will debounce and batch uploads.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {status === 'invalid' && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/5 p-2 rounded">
                <AlertTriangle size={14} />
                <span>Invalid TMDB API Key</span>
              </div>
            )}
            {status === 'valid' && (
              <div className="flex items-center gap-2 text-emerald-300 text-sm bg-emerald-400/6 p-2 rounded">
                <Save size={14} />
                <span>Saved</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white rounded-md transition"
            >
              Cancel
            </button>

            <button
              onClick={handleSave}
              disabled={status === 'checking'}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold px-4 py-2 rounded-md shadow"
            >
              {status === 'checking' ? 'Verifying…' : 'Save configuration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;