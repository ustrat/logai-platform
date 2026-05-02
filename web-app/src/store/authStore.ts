import { create } from 'zustand';
import { cognitoSignOut } from '../services/cognitoAuth';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthStore {
  user: User | null;
  token: string | null;      // idToken — sent as Bearer to API
  refreshToken: string | null;
  setAuth: (user: User, idToken: string, refreshToken: string) => void;
  logout: () => void;
}

const stored = (() => {
  try {
    const raw = localStorage.getItem('vp_auth');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
})();

export const useAuthStore = create<AuthStore>((set) => ({
  user:         stored?.user         ?? null,
  token:        stored?.token        ?? null,
  refreshToken: stored?.refreshToken ?? null,

  setAuth: (user, idToken, refreshToken) => {
    localStorage.setItem('vp_auth', JSON.stringify({ user, token: idToken, refreshToken }));
    set({ user, token: idToken, refreshToken });
  },

  logout: () => {
    cognitoSignOut();
    localStorage.removeItem('vp_auth');
    set({ user: null, token: null, refreshToken: null });
  },
}));
