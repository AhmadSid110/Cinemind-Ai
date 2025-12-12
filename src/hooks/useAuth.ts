// src/hooks/useAuth.ts
import { useState, useEffect } from 'react';
import {
  auth,
  loginWithGoogle,
  subscribeToAuthChanges,
  registerWithEmail,
  loginWithEmail,
  sendResetEmail,
  logout as firebaseLogout,
} from '../firebase';
import type { User } from 'firebase/auth';

/**
 * Authentication hook that provides methods for user authentication and state management.
 * Supports Google OAuth and email/password authentication.
 * 
 * @returns {Object} Authentication state and methods
 * @property {User | null} user - Current authenticated user or null
 * @property {boolean} loading - Whether authentication state is being initialized
 * @property {Function} login - Sign in with Google popup
 * @property {Function} loginEmail - Sign in with email and password
 * @property {Function} register - Register new account with email and password
 * @property {Function} resetPassword - Send password reset email
 * @property {Function} logout - Sign out current user
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((authUser) => {
      setUser(authUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Google sign-in (existing)
  const login = async () => {
    try {
      return await loginWithGoogle();
    } catch (err) {
      console.error('Login error:', err);
      throw err;
    }
  };

  // Email/password sign-in
  const loginEmail = async (email: string, password: string) => {
    try {
      return await loginWithEmail(email, password);
    } catch (err) {
      console.error('Email login error:', err);
      throw err;
    }
  };

  // Register new account with email/password
  const register = async (email: string, password: string) => {
    try {
      return await registerWithEmail(email, password);
    } catch (err) {
      console.error('Register error:', err);
      throw err;
    }
  };

  // Reset password
  const resetPassword = async (email: string) => {
    try {
      return await sendResetEmail(email);
    } catch (err) {
      console.error('Password reset error:', err);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await firebaseLogout();
    } catch (err) {
      console.error('Logout error:', err);
      throw err;
    }
  };

  return {
    user,
    loading,
    login, // google popup
    loginEmail,
    register,
    resetPassword,
    logout,
  };
}
