import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost, apiPut } from './api';
import type { Role, UserProfile } from './types';

const normalizeRole = (value: string): Role => {
  const role = value.toLowerCase();
  if (role === 'admin' || role === 'administrator') return 'administrator';
  if (role === 'procurement' || role === 'procurement_manager') return 'procurement_manager';
  if (role === 'manager' || role === 'scm' || role === 'supply_chain_manager') return 'supply_chain_manager';
  if (role === 'finance' || role === 'finance_officer') return 'finance_officer';
  if (role === 'auditor') return 'auditor';
  return 'vendor';
};

const profileFrom = (value: any): UserProfile => ({
  id: Number(value?.id ?? value?.user_id ?? 0),
  name: value?.name ?? value?.full_name ?? 'User',
  email: value?.email ?? '',
  role: normalizeRole(value?.role ?? 'vendor'),
  vendor_id: value?.vendor_id ?? null,
  vendor_name: value?.vendor_name ?? null,
  created_at: value?.created_at,
});

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserProfile>;
  register: (payload: { name: string; email: string; password: string; role?: string }) => Promise<any>;
  requestReset: (email: string) => Promise<any>;
  confirmReset: (token: string, password: string) => Promise<any>;
  updateProfile: (name: string) => Promise<UserProfile>;
  logout: () => void;
  hasRole: (roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('vendoriq_token');
    if (!token) {
      setLoading(false);
      return;
    }

    apiGet('/users/me')
      .then((data) => setUser(profileFrom(data)))
      .catch(() => {
        localStorage.removeItem('vendoriq_token');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,

    async login(email, password) {
      const data = await apiPost<any>('/login', { email, password });
      localStorage.setItem('vendoriq_token', data.access_token);
      const profile = profileFrom(data);
      setUser(profile);
      return profile;
    },

    register(payload) {
      return apiPost('/register', payload);
    },

    requestReset(email) {
      return apiPost('/auth/password-reset/request', { email });
    },

    confirmReset(token, password) {
      return apiPost('/auth/password-reset/confirm', { token, password });
    },

    async updateProfile(name) {
      const result = profileFrom(await apiPut('/users/me', { name }));
      setUser(result);
      return result;
    },

    logout() {
      localStorage.removeItem('vendoriq_token');
      setUser(null);
    },

    hasRole(roles) {
      if (!user) return false;
      if (user.role === 'administrator') return true;
      return roles.map(normalizeRole).includes(user.role);
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export const landingPathFor = (role: Role): string => {
  switch (role) {
    case 'procurement_manager': return '/procurement';
    case 'supply_chain_manager': return '/reliability';
    case 'vendor': return '/performance';
    case 'finance_officer': return '/invoices';
    case 'auditor': return '/audit';
    default: return '/dashboard';
  }
};

export function NavigateAfterLogout() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/login', { replace: true });
  }, [navigate]);
  return null;
}
