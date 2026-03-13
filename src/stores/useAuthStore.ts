import { authService } from "@/services/authService";
import { create } from "zustand";
import type { AuthState } from "@/types/store";

export const useAuthStore = create<AuthState>()((set, get) => ({
  accessToken: localStorage.getItem("accessToken"),
  refreshToken: localStorage.getItem("refreshToken"),
  user: null,
  loading: false,

  setAccessToken: (accessToken) => {
    localStorage.setItem("accessToken", accessToken);
    set({ accessToken });
  },
  setUser: (user) => set({ user }),

  clearState: () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    set({ accessToken: null, refreshToken: null, user: null, loading: false });
  },

  signUp: async (username, password, email, firstName, lastName) => {
    set({ loading: true });
    try {
      await authService.signUp(username, password, email, firstName, lastName);
    } finally {
      set({ loading: false });
    }
  },

  signIn: async (username, password) => {
    set({ loading: true });
    try {
      const data = await authService.signIn(username, password);
      // Backend returns { accessToken, refreshToken }
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      set({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    await authService.signOut();
    set({ accessToken: null, refreshToken: null, user: null });
  },

  fetchMe: async () => {
    try {
      const user = await authService.fetchMe();
      set({ user });
    } catch (error) {
      console.error("Failed to fetch user profile", error);
      // If 401, the axios interceptor will handle redirect
    }
  },

  refresh: async () => {
    const { refreshToken } = get();
    if (!refreshToken) return;

    try {
      const newAccessToken = await authService.refresh(refreshToken);
      localStorage.setItem("accessToken", newAccessToken);
      set({ accessToken: newAccessToken });
    } catch (error) {
      console.error("Token refresh failed", error);
      get().clearState();
    }
  },
}));