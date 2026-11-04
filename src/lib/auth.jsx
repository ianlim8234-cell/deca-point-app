import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const AuthCtx = createContext(null);
const ConfigCtx = createContext(null);

export function AppProviders({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading
  const [config, setConfig] = useState(null);

  const refreshUser = useCallback(async () => {
    try {
      const r = await api('/me');
      setUser(r.user);
      return r.user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  const refreshConfig = useCallback(async () => {
    const c = await api('/public/config');
    setConfig(c);
    return c;
  }, []);

  useEffect(() => {
    refreshUser();
    refreshConfig().catch(() => {});
  }, [refreshUser, refreshConfig]);

  const logout = async () => {
    await api('/auth/logout', { method: 'POST', body: {} }).catch(() => {});
    setUser(null);
  };

  return (
    <ConfigCtx.Provider value={{ config, refreshConfig }}>
      <AuthCtx.Provider value={{ user, setUser, refreshUser, logout }}>{children}</AuthCtx.Provider>
    </ConfigCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
export const useConfig = () => useContext(ConfigCtx);

const RANK = { customer: 0, employee: 1, manager: 2, owner: 3 };
export const hasRole = (user, min) => !!user && RANK[user.role] >= RANK[min];
