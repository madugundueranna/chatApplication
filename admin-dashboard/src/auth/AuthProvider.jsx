import { createContext, useContext, useEffect, useState } from 'react';
import * as authApi from '../api/auth.api';
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
} from '../lib/tokens';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // `loading` covers the initial session restore so ProtectedRoute can wait.
  const [loading, setLoading] = useState(true);

  // On boot: if we have a token, confirm it still belongs to an admin.
  useEffect(() => {
    if (!getAccessToken()) {
      setLoading(false);
      return;
    }
    authApi
      .getMe()
      .then((me) => {
        if (me?.role === 'admin') setUser(me);
        else clearTokens();
      })
      .catch(() => clearTokens())
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await authApi.login(email, password); // { accessToken, refreshToken, user }
    if (data?.user?.role !== 'admin') {
      // Never store tokens for a non-admin account.
      throw { message: 'This account is not an admin.' };
    }
    setTokens(data);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      // Best effort — clear locally regardless of the network result.
    }
    clearTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
