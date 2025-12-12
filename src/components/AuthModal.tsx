// src/components/AuthModal.tsx
import React, { useState } from 'react';
import { LogIn, LogOut, Mail, Key, Zap } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login, loginEmail, register, resetPassword } = useAuth();
  const [mode, setMode] = useState<'signin' | 'register' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const clearMsgs = () => {
    setError(null);
    setOkMsg(null);
  };

  const doGoogle = async () => {
    setBusy(true);
    clearMsgs();
    try {
      await login();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Google sign in failed');
    } finally {
      setBusy(false);
    }
  };

  const doEmailSignIn = async () => {
    setBusy(true);
    clearMsgs();
    try {
      await loginEmail(email.trim(), password);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  const doRegister = async () => {
    setBusy(true);
    clearMsgs();
    try {
      await register(email.trim(), password);
      setOkMsg('Registration successful — you are signed in.');
      setTimeout(onClose, 600);
    } catch (e: any) {
      setError(e?.message || 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  const doReset = async () => {
    setBusy(true);
    clearMsgs();
    try {
      await resetPassword(email.trim());
      setOkMsg('Password reset email sent (check your inbox).');
    } catch (e: any) {
      setError(e?.message || 'Reset failed');
    } finally {
      setBusy(false);
    }
  };

  const handleBackToSignIn = () => {
    setMode('signin');
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">
            {mode === 'signin' ? 'Sign in' : mode === 'register' ? 'Register' : 'Reset password'}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode('signin')}
              className={`px-3 py-1 rounded ${mode === 'signin' ? 'bg-cyan-600 text-white' : 'bg-transparent text-slate-400'}`}
            >
              Sign in
            </button>
            <button
              onClick={() => setMode('register')}
              className={`px-3 py-1 rounded ${mode === 'register' ? 'bg-emerald-600 text-white' : 'bg-transparent text-slate-400'}`}
            >
              Register
            </button>
            <button
              onClick={() => setMode('reset')}
              className={`px-3 py-1 rounded ${mode === 'reset' ? 'bg-amber-500 text-white' : 'bg-transparent text-slate-400'}`}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="auth-email" className="text-xs text-slate-400">Email</label>
            <div className="mt-1 flex items-center gap-2">
              <Mail className="text-slate-400" />
              <input
                id="auth-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white outline-none"
                placeholder="you@example.com"
                type="email"
                aria-label="Email address"
              />
            </div>
          </div>

          {mode !== 'reset' && (
            <div>
              <label htmlFor="auth-password" className="text-xs text-slate-400">Password</label>
              <div className="mt-1 flex items-center gap-2">
                <Key className="text-slate-400" />
                <input
                  id="auth-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white outline-none"
                  placeholder="••••••••"
                  type="password"
                  aria-label="Password"
                />
              </div>
            </div>
          )}

          {error && <div className="text-sm text-red-400">{error}</div>}
          {okMsg && <div className="text-sm text-emerald-400">{okMsg}</div>}

          <div className="flex gap-2 mt-2">
            {mode === 'signin' && (
              <>
                <button
                  onClick={doEmailSignIn}
                  disabled={busy}
                  className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded py-2 font-semibold"
                >
                  {busy ? 'Signing in…' : 'Sign in with email'}
                </button>
                <button
                  onClick={doGoogle}
                  disabled={busy}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-slate-100 rounded py-2 font-semibold flex items-center justify-center gap-2"
                >
                  <Zap className="text-amber-400" />
                  {busy ? 'Please wait…' : 'Sign in with Google'}
                </button>
              </>
            )}

            {mode === 'register' && (
              <button disabled={busy} onClick={doRegister} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded py-2 font-semibold">
                {busy ? 'Registering…' : 'Create account'}
              </button>
            )}

            {mode === 'reset' && (
              <button disabled={busy} onClick={doReset} className="w-full bg-amber-500 hover:bg-amber-400 text-white rounded py-2 font-semibold">
                {busy ? 'Sending…' : 'Send reset email'}
              </button>
            )}
          </div>

          <div className="flex justify-between text-xs text-slate-500 mt-3">
            <button onClick={handleBackToSignIn} className="underline">Back to Sign in</button>
            <button onClick={onClose} className="underline">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
