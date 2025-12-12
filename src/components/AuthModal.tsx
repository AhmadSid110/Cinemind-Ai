// src/components/AuthModal.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  LogIn,
  Zap,
  Mail,
  Key,
  Eye,
  EyeOff,
  Loader2,
  Check,
  X,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMAIL_REGEX =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MIN_PASSWORD_LENGTH = 6;

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login, loginEmail, register, resetPassword } = useAuth();

  const [mode, setMode] = useState<'signin' | 'register' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const emailRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);

  // Reset internal state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setPassword('');
      setError(null);
      setOkMsg(null);
      setBusy(false);
      setShowPassword(false);
      // focus appropriate input after open
      setTimeout(() => {
        if (emailRef.current) emailRef.current.focus();
      }, 50);
    }
  }, [isOpen, mode]);

  // handle Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        // Enter submits depending on mode
        // Avoid accidental submit when busy
        if (busy) return;
        if (mode === 'signin') doEmailSignIn();
        if (mode === 'register') doRegister();
        if (mode === 'reset') doReset();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode, email, password, busy]);

  const clearMsgs = () => {
    setError(null);
    setOkMsg(null);
  };

  // client-side validation helpers
  const validEmail = EMAIL_REGEX.test(email.trim());
  const validPassword = password.length >= MIN_PASSWORD_LENGTH;

  // Debounce guard: prevents double action clicks quickly
  const clickGuard = useRef(false);
  async function guardRun(fn: () => Promise<void>) {
    if (clickGuard.current) return;
    clickGuard.current = true;
    try {
      await fn();
    } finally {
      // short throttle
      setTimeout(() => {
        clickGuard.current = false;
      }, 400);
    }
  }

  const doGoogle = async () => {
    clearMsgs();
    setBusy(true);
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
    clearMsgs();
    if (!validEmail) {
      setError('Enter a valid email address');
      return;
    }
    if (!validPassword) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    await guardRun(async () => {
      setBusy(true);
      try {
        await loginEmail(email.trim(), password);
        onClose();
      } catch (e: any) {
        setError(e?.message || 'Sign in failed');
      } finally {
        setBusy(false);
      }
    });
  };

  const doRegister = async () => {
    clearMsgs();
    if (!validEmail) {
      setError('Enter a valid email address');
      return;
    }
    if (!validPassword) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    await guardRun(async () => {
      setBusy(true);
      try {
        await register(email.trim(), password);
        setOkMsg('Registration successful — you are signed in.');
        setTimeout(onClose, 700);
      } catch (e: any) {
        setError(e?.message || 'Registration failed');
      } finally {
        setBusy(false);
      }
    });
  };

  const doReset = async () => {
    clearMsgs();
    if (!validEmail) {
      setError('Enter a valid email address to reset password');
      return;
    }
    await guardRun(async () => {
      setBusy(true);
      try {
        await resetPassword(email.trim());
        setOkMsg('Password reset email sent — check your inbox.');
      } catch (e: any) {
        setError(e?.message || 'Reset failed');
      } finally {
        setBusy(false);
      }
    });
  };

  // small helper to render primary action button text / handler
  const PrimaryButton = () => {
    if (mode === 'signin') {
      return (
        <button
          onClick={doEmailSignIn}
          disabled={busy || !validEmail || !validPassword}
          className={`flex-1 rounded py-2 font-semibold ${
            busy || !validEmail || !validPassword
              ? 'bg-slate-700 text-slate-300 cursor-not-allowed'
              : 'bg-cyan-600 hover:bg-cyan-500 text-white'
          }`}
        >
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="animate-spin" size={16} /> Signing in…
            </span>
          ) : (
            'Sign in with email'
          )}
        </button>
      );
    }
    if (mode === 'register') {
      return (
        <button
          onClick={doRegister}
          disabled={busy || !validEmail || !validPassword}
          className={`w-full rounded py-2 font-semibold ${
            busy || !validEmail || !validPassword
              ? 'bg-slate-700 text-slate-300 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
          }`}
        >
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="animate-spin" size={16} /> Creating…
            </span>
          ) : (
            'Create account'
          )}
        </button>
      );
    }
    // reset
    return (
      <button
        onClick={doReset}
        disabled={busy || !validEmail}
        className={`w-full rounded py-2 font-semibold ${
          busy || !validEmail
            ? 'bg-slate-700 text-slate-300 cursor-not-allowed'
            : 'bg-amber-500 hover:bg-amber-400 text-white'
        }`}
      >
        {busy ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="animate-spin" size={16} /> Sending…
          </span>
        ) : (
          'Send reset email'
        )}
      </button>
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Authentication"
    >
      <div className="w-full max-w-md bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <LogIn size={20} className="text-cyan-400" />
            <h3 className="text-lg font-bold text-white">
              {mode === 'signin' ? 'Sign in' : mode === 'register' ? 'Register' : 'Reset password'}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode('signin')}
              className={`px-3 py-1 rounded text-sm ${mode === 'signin' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}
              aria-pressed={mode === 'signin'}
            >
              Sign in
            </button>
            <button
              onClick={() => setMode('register')}
              className={`px-3 py-1 rounded text-sm ${mode === 'register' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
              aria-pressed={mode === 'register'}
            >
              Register
            </button>
            <button
              onClick={() => setMode('reset')}
              className={`px-3 py-1 rounded text-sm ${mode === 'reset' ? 'bg-amber-500 text-white' : 'text-slate-400'}`}
              aria-pressed={mode === 'reset'}
            >
              Reset
            </button>
            <button
              onClick={onClose}
              title="Close"
              className="ml-2 p-1 rounded bg-transparent text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-xs text-slate-400" htmlFor="auth-email">Email</label>
          <div className="mt-1 flex items-center gap-2">
            <Mail className="text-slate-400" />
            <input
              id="auth-email"
              ref={emailRef}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white outline-none"
              placeholder="you@example.com"
              type="email"
              aria-label="Email address"
              aria-invalid={!validEmail && email.length > 0}
            />
          </div>

          {mode !== 'reset' && (
            <>
              <label className="text-xs text-slate-400" htmlFor="auth-password">Password</label>
              <div className="mt-1 flex items-center gap-2">
                <Key className="text-slate-400" />
                <input
                  id="auth-password"
                  ref={passwordRef}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded p-2 text-sm text-white outline-none"
                  placeholder="••••••••"
                  type={showPassword ? 'text' : 'password'}
                  aria-label="Password"
                  aria-invalid={password.length > 0 && password.length < MIN_PASSWORD_LENGTH}
                />
                <button
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-xs text-slate-500">Password must be at least {MIN_PASSWORD_LENGTH} characters.</p>
            </>
          )}

          {/* messages */}
          <div aria-live="polite" className="min-h-[1.25rem]">
            {error && <div className="text-sm text-red-400">{error}</div>}
            {okMsg && <div className="text-sm text-emerald-400 flex items-center gap-2"><Check size={14} />{okMsg}</div>}
          </div>

          {/* actions */}
          <div className="flex gap-2 mt-2">
            {mode === 'signin' ? (
              <>
                <PrimaryButton />
                <button
                  onClick={() => guardRun(doGoogle)}
                  disabled={busy}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-slate-100 rounded py-2 font-semibold flex items-center justify-center gap-2"
                >
                  {busy ? <Loader2 className="animate-spin" size={16} /> : <Zap className="text-amber-400" />}
                  {busy ? 'Please wait…' : 'Sign in with Google'}
                </button>
              </>
            ) : (
              <PrimaryButton />
            )}
          </div>

          <div className="flex justify-between text-xs text-slate-500 mt-3">
            {mode !== 'signin' ? (
              <button onClick={() => { setMode('signin'); clearMsgs(); }} className="underline">Back to Sign in</button>
            ) : (
              <button onClick={() => { setMode('reset'); clearMsgs(); }} className="underline">Forgot password?</button>
            )}
            <button onClick={onClose} className="underline">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;