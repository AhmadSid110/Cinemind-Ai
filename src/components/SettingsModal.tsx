import React, { useState, useEffect } from 'react';
import { Key, Save, AlertTriangle, Sparkles } from 'lucide-react';
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

  /**
   * onSave's signature extended:
   * onSave(tmdbKey, geminiKey, openaiKey, omdbKey, useOmdbRatings, showEpisodeImdbOnCards, showEpisodeImdbOnSeasonList, enableCloudSync)
   */
  onSave: (
    tmdbKey: string,
    geminiKey: string,
    openaiKey: string,
    omdbKey: string,
    useOmdbRatings: boolean,
    showEpisodeImdbOnCards: boolean,
    showEpisodeImdbOnSeasonList: boolean,
    enableCloudSync: boolean
  ) => void;
  onClose: () => void;
  isOpen: boolean;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  currentKey,
  currentGeminiKey,
  currentOpenAIKey,
  currentOmdbKey,
  useOmdbRatings,
  currentShowEpisodeImdbOnCards,
  currentShowEpisodeImdbOnSeasonList,
  currentCloudSync,
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

  const [status, setStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');

  // …and kept in sync if props change (e.g. when Firebase finishes loading)
  useEffect(() => {
    setKeyInput(currentKey || '');
  }, [currentKey]);

  useEffect(() => {
    setGeminiKeyInput(currentGeminiKey || '');
  }, [currentGeminiKey]);

  useEffect(() => {
    setOpenaiKeyInput(currentOpenAIKey || '');
  }, [currentOpenAIKey]);

  useEffect(() => {
    setOmdbKeyInput(currentOmdbKey || '');
  }, [currentOmdbKey]);

  useEffect(() => {
    setUseOmdbToggle(useOmdbRatings);
  }, [useOmdbRatings]);

  useEffect(() => {
    setShowEpisodeImdbOnCards(currentShowEpisodeImdbOnCards);
  }, [currentShowEpisodeImdbOnCards]);

  useEffect(() => {
    setShowEpisodeImdbOnSeasonList(currentShowEpisodeImdbOnSeasonList);
  }, [currentShowEpisodeImdbOnSeasonList]);

  useEffect(() => {
    setEnableCloudSync(!!currentCloudSync);
  }, [currentCloudSync]);

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
          enableCloudSync
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center gap-3 p-8 pb-4 text-cyan-400">
          <Key size={32} />
          <h2 className="text-2xl font-bold text-white">App Configuration</h2>
        </div>
        
        {/* Scrollable content area */}
        <div className="overflow-y-auto px-8 pb-4 flex-1">

        {/* TMDB Section */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="text-xs font-bold uppercase text-slate-500 block mb-1">
              TMDB API Key (Required)
            </label>
            <input
              type="text"
              value={keyInput}
              onChange={(e) => {
                setKeyInput(e.target.value);
                setStatus('idle');
              }}
              placeholder="TMDB API Key (v3)"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-cyan-500 transition font-mono text-xs"
            />
          </div>
          <p className="text-slate-500 text-xs">
            Required for movie data. Get it from{' '}
            <a
              href="https://www.themoviedb.org/settings/api"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-400 hover:underline"
            >
              TMDB Settings
            </a>
            .
          </p>
        </div>

        {/* Gemini Section */}
        <div className="space-y-4 mb-6 pt-4 border-t border-slate-800">
          <div>
            <label className="text-xs font-bold uppercase text-slate-500 block mb-1 flex items-center gap-1">
              <Sparkles size={12} /> Google Gemini API Key (Optional)
            </label>
            <input
              type="text"
              value={geminiKeyInput}
              onChange={(e) => {
                setGeminiKeyInput(e.target.value);
                // we don't change TMDB validity if only Gemini changes
              }}
              placeholder="AIzaSy..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-purple-500 transition font-mono text-xs"
            />
          </div>
          <p className="text-slate-500 text-xs">
            Optional for Natural Language Search. Get it from{' '}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-purple-400 hover:underline"
            >
              Google AI Studio
            </a>
            .
          </p>
        </div>

        {/* OpenAI Section */}
        <div className="space-y-4 mb-6 pt-4 border-t border-slate-800">
          <div>
            <label className="text-xs font-bold uppercase text-slate-500 block mb-1 flex items-center gap-1">
              <Sparkles size={12} /> OpenAI API Key (Optional)
            </label>
            <input
              type="text"
              value={openaiKeyInput}
              onChange={(e) => {
                setOpenaiKeyInput(e.target.value);
              }}
              placeholder="sk-..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-emerald-500 transition font-mono text-xs"
            />
          </div>
          <p className="text-slate-500 text-xs">
            Optional for Natural Language Search (alternative to Gemini). Get it from{' '}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 hover:underline"
            >
              OpenAI Platform
            </a>
            .
          </p>
        </div>

        {/* OMDb Section */}
        <div className="space-y-4 mb-6 pt-4 border-t border-slate-800">
          <div>
            <label className="text-xs font-bold uppercase text-slate-500 block mb-1 flex items-center gap-1">
              <Sparkles size={12} /> OMDb API Key (Optional)
            </label>
            <input
              type="text"
              value={omdbKeyInput}
              onChange={(e) => {
                setOmdbKeyInput(e.target.value);
              }}
              placeholder="Enter OMDb API key..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-amber-500 transition font-mono text-xs"
            />
          </div>
          <p className="text-slate-500 text-xs">
            Optional for IMDb, Metacritic, and Rotten Tomatoes ratings. Get it from{' '}
            <a
              href="https://www.omdbapi.com/apikey.aspx"
              target="_blank"
              rel="noreferrer"
              className="text-amber-400 hover:underline"
            >
              OMDb API
            </a>
            .
          </p>
          
          {/* Toggle for OMDb Ratings */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-300">Use OMDb Ratings</span>
              <span className="text-xs text-slate-500">Show IMDb/Metacritic/RT ratings instead of TMDB only</span>
            </div>
            <button
              type="button"
              onClick={() => setUseOmdbToggle(!useOmdbToggle)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                useOmdbToggle ? 'bg-amber-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  useOmdbToggle ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* NEW: Episode IMDb UI toggles */}
        <div className="space-y-4 mb-6 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-300">Show episode IMDb on cards</span>
              <span className="text-xs text-slate-500">Display episode-level IMDb rating on home / search cards for episodes (if available)</span>
            </div>
            <button
              type="button"
              onClick={() => setShowEpisodeImdbOnCards(!showEpisodeImdbOnCards)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                showEpisodeImdbOnCards ? 'bg-amber-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  showEpisodeImdbOnCards ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-300">Show episode IMDb in season listings</span>
              <span className="text-xs text-slate-500">Show episode IMDb rating alongside episodes inside the season list on the Details page</span>
            </div>
            <button
              type="button"
              onClick={() => setShowEpisodeImdbOnSeasonList(!showEpisodeImdbOnSeasonList)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                showEpisodeImdbOnSeasonList ? 'bg-amber-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  showEpisodeImdbOnSeasonList ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Cloud Sync Toggle */}
        <div className="space-y-4 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-slate-300">Sync ratings across devices</span>
              <span className="text-xs text-slate-500">Upload OMDb cache to your Firestore account (opt-in)</span>
            </div>
            <button
              type="button"
              onClick={() => setEnableCloudSync(!enableCloudSync)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                enableCloudSync ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enableCloudSync ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
        </div>

        {/* Status messages and buttons - fixed at bottom */}
        <div className="px-8 pb-8 pt-4">
        {status === 'invalid' && (
          <div className="flex items-center gap-2 text-red-400 text-sm mb-4 bg-red-400/10 p-2 rounded">
            <AlertTriangle size={16} />
            Invalid TMDB API Key.
          </div>
        )}

        {status === 'valid' && (
          <div className="flex items-center gap-2 text-emerald-400 text-sm mb-4 bg-emerald-400/10 p-2 rounded">
            <Save size={16} />
            Configuration saved successfully!
          </div>
        )}

          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={status === 'checking'}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold px-6 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-cyan-900/20"
            >
              {status === 'checking' ? 'Verifying...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;