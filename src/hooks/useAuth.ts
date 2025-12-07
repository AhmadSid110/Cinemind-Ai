// src/hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { auth, loginWithGoogle, subscribeToAuthChanges } from '../firebase';

/**
 * Hook for authentication logic only.
 * Handles Google login, logout, and user identity state.
 */
export function useAuth() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((authUser) => {
      setUser(authUser);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error('Login error:', err);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await auth.signOut();
    } catch (err) {
      console.error('Logout error:', err);
      throw err;
    }
  };

  return {
    user,
    login,
    logout,
  };
}
