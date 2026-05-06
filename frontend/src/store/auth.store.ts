import { create } from 'zustand';
import type { User } from '../types';
import * as authApi from '../api/auth';
import { setAccessToken } from '../api/client';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<string>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  updateProfile: (data: { name?: string; email?: string; emailNotifications?: boolean }) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  login: async (email, password) => {
    const { accessToken } = await authApi.login(email, password);
    setAccessToken(accessToken);
    const user = await authApi.getMe();
    set({ user });
  },

  register: async (email, password, name) => {
    const { message } = await authApi.register(email, password, name);
    return message;
  },

  updateProfile: async (data) => {
    const user = await authApi.updateProfile(data);
    set({ user });
  },

  logout: async () => {
    await authApi.logout().catch(() => {});
    setAccessToken(null);
    set({ user: null });
  },

  loadUser: async () => {
    try {
      // Try to restore session via HttpOnly refresh token cookie.
      // Also used by the SSO callback flow (sso_return=1).
      const { accessToken } = await authApi.refreshToken();
      setAccessToken(accessToken);
      const user = await authApi.getMe();
      set({ user, loading: false });
    } catch {
      setAccessToken(null);
      set({ user: null, loading: false });
    }
  },
}));
