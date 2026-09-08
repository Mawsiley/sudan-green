import { createContext, useContext, useState, useCallback } from 'react';
import { apiCall } from '../api';

const AuthContext = createContext(null);

function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem('sg_session') || 'null');
    if (s?.token && new Date(s.expiresAt) > new Date()) return s;
  } catch {}
  return null;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(loadSession);

  const login = useCallback(async (phone, password, countryCode = '249') => {
    const r = await apiCall('login', { phone, password, countryCode });
    if (r.success && r.data) {
      localStorage.setItem('sg_session', JSON.stringify(r.data));
      setSession(r.data);
    }
    return r;
  }, []);

  const logout = useCallback(async () => {
    try { await apiCall('logout', {}, session?.token); } catch {}
    localStorage.removeItem('sg_session');
    setSession(null);
  }, [session]);

  const api = useCallback((action, params = {}) => {
    return apiCall(action, params, session?.token);
  }, [session]);

  const isAdmin = ['admin', 'super_admin', 'settings_admin'].includes(session?.roleId);
  const isSettingsAdmin = session?.roleId === 'settings_admin';

  return (
    <AuthContext.Provider value={{ session, login, logout, api, isAdmin, isSettingsAdmin, isAuthenticated: !!session }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
