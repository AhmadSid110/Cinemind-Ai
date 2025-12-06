import React, { useState, useEffect } from 'react';
import { Key, Save, AlertTriangle, Sparkles } from 'lucide-react';
import { validateKey } from '../services/tmdbService';

interface SettingsModalProps {
  currentKey: string;
  currentGeminiKey: string;
  onSave: (tmdbKey: string, geminiKey: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  currentKey,
  currentGeminiKey,
  onSave,
  onClose,
  isOpen,
}) => {
  // Local input state, initialized from props…
  const [keyInput, setKeyInput] = useState(currentKey || '');
  const [geminiKeyInput, setGeminiKeyInput] = useState(currentGeminiKey || '');
  const [status, setStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');

  // …and kept in sync if props change (e.g. when Firebase finishes loading)
  useEffect(() => {
    setKeyInput(currentKey || '');
  }, [currentKey]);

  useEffect(() => {
    setGeminiKeyInput(currentGeminiKey || '');
  }, [currentGeminiKey]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const trimmedTmdb = keyInput.trim();
    const trimmedGemini = geminiKeyInput.trim();

    if (!trimmedTmdb) {
      setStatus('invalid');
      return;
    }

    setStatus('checking');

    try {
      const isValid = await validateKey(trimmedTmdb);

      if (isValid) {
        setStatus('valid');
        // Let parent (App.tsx) update state + Firebase
        onSave(trimmedTmdb, trimmedGemini);

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md p-8 rounded-2xl shadow-2xl">
        <div className="flex items-center gap-3 mb-6 text-cyan-400">
          <Key size={32} />
          <h2 className="text-2xl font-bold text-white">App Configuration</h2>
        </div>

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
              <Sparkles size={12} /> Google Gemini API Key
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
            Required for Natural Language Search. Get it from{' '}
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
  );
};

export default SettingsModal;