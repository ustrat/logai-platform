import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  isHydrated: boolean;
  setAuth: (user: User, token: string) => Promise<void>;
  logout: () => Promise<void>;
  loadToken: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  isHydrated: false,

  setAuth: async (user, token) => {
    await SecureStore.setItemAsync('token', token);
    set({ user, token });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('token');
    set({ user: null, token: null });
  },

  loadToken: async () => {
    const token = await SecureStore.getItemAsync('token');
    set({ token: token ?? null, isHydrated: true });
  },
}));