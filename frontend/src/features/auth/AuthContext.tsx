// frontend/src/features/auth/AuthContext.tsx

import { useEffect, useState, type ReactNode } from 'react';
import type { AuthUser } from '@/types';
import { api, AUTH_EXPIRED_EVENT, setAuthToken, setRefreshToken } from '@/services/apiClient';
import { AuthContext } from './auth-context';

const SESSION_KEY = 'virtual-guard.session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const clearStoredAuth = () => {
      setUser(null);
      setAuthToken(null);
      setRefreshToken(null);
      localStorage.removeItem(SESSION_KEY);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, clearStoredAuth);

    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AuthUser;
        const token = localStorage.getItem('accessToken');
        const storedRefreshToken = localStorage.getItem('refreshToken');
        if (token || storedRefreshToken) {
          setUser(parsed);
        }
        if (token) {
          setAuthToken(token);
        } else if (!storedRefreshToken) {
          clearStoredAuth();
        }
      } catch {
        clearStoredAuth();
      }
    } else if (localStorage.getItem('accessToken') || localStorage.getItem('refreshToken')) {
      clearStoredAuth();
    }
    setIsInitializing(false);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, clearStoredAuth);
  }, []);

  async function login(email: string, password: string): Promise<AuthUser> {
    try {
      // Call real backend
      const response = await api.post<{ accessToken: string; refreshToken: string; user: AuthUser }>('/api/auth/login', {
        email,
        password,
      });
      
      const { accessToken, refreshToken, user: userData } = response;
      
      // Store token
      setAuthToken(accessToken);
      setRefreshToken(refreshToken);
      // Store user
      setUser(userData);
      localStorage.setItem(SESSION_KEY, JSON.stringify(userData));
      
      return userData;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  function logout() {
    setUser(null);
    setAuthToken(null);
    setRefreshToken(null);
    localStorage.removeItem(SESSION_KEY);
  }

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: user !== null, isInitializing, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
