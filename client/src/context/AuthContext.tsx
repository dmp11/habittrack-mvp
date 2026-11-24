import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, onUnauthorized, refreshSession, setAccessToken } from '../api';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; name?: string; timezone?: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: { name?: string; timezone?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    onUnauthorized(() => {
      setAccessToken(null);
      setUser(null);
    });

    (async () => {
      try {
        if (await refreshSession()) {
          const response = await api.getMe();
          if (active) setUser(response.user);
        }
      } catch {
        // Нет активной сессии — показываем форму входа.
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      onUnauthorized(() => {});
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.login({ email, password });
    setUser(response.user);
  }, []);

  const register = useCallback(async (data: { email: string; password: string; name?: string; timezone?: string }) => {
    const response = await api.register(data);
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const updateUser = useCallback(async (data: { name?: string; timezone?: string }) => {
    const response = await api.updateMe(data);
    setUser(response.user);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, updateUser }),
    [user, loading, login, register, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth должен использоваться внутри AuthProvider');
  return context;
}
