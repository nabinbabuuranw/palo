import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type User } from './api';
interface Biz { id: number; slug: string; name: string; status: string; plan: string; is_demo: number }
interface AuthState { user: User | null; business: Biz | null; unread: number; loading: boolean; refresh: () => Promise<void>; logout: () => Promise<void>; setUser: (u: User | null) => void }
const Ctx = createContext<AuthState>(null as any);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ user: User | null; business: Biz | null; unread: number; loading: boolean }>({ user: null, business: null, unread: 0, loading: true });
  const refresh = useCallback(async () => {
    try { const r = await api('/auth/me'); setState({ user: r.user, business: r.business || null, unread: r.unread || 0, loading: false }); }
    catch { setState((s) => ({ ...s, loading: false })); }
  }, []);
  useEffect(() => { refresh(); const t = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 45000); return () => clearInterval(t); }, [refresh]);
  const logout = useCallback(async () => { try { await api('/auth/logout', { method: 'POST' }); } finally { setState({ user: null, business: null, unread: 0, loading: false }); } }, []);
  const setUser = (u: User | null) => setState((s) => ({ ...s, user: u }));
  return <Ctx.Provider value={{ ...state, refresh, logout, setUser }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
export const homeFor = (role?: string) => role === 'owner' ? '/dashboard' : role === 'admin' ? '/admin' : '/me';
