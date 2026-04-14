import { authService } from "@/services/authService";
import { create } from "zustand";
import type { AuthState } from "@/types/store";

export const useAuthStore = create<AuthState>()((set, get) => ({
  accessToken: localStorage.getItem("accessToken"),
  user: null,
  loading: false,

  setAccessToken: (accessToken) => {
    localStorage.setItem("accessToken", accessToken);
    set({ accessToken });
  },
  setUser: (user) => set({ user }),

  clearState: () => {
    localStorage.removeItem("accessToken");
    set({ accessToken: null, user: null, loading: false });
  },

  signUp: async (username, password, email, firstName, lastName) => {
    set({ loading: true });
    try {
      await authService.signUp(username, password, email, firstName, lastName);
    } finally {
      set({ loading: false });
    }
  },


  sendSignupOtp: async (email, username?) => {
    set({ loading: true });
    try {
      await authService.sendSignupOtp(email, username);
    } finally {
      set({ loading: false });
    }
  },

  signIn: async (username, password) => {
    set({ loading: true });
    try {
      const data = await authService.signIn(username, password);
      // Backend returns { accessToken } and sets refresh token in HttpOnly cookie.
      localStorage.setItem("accessToken", data.accessToken);
      set({
        accessToken: data.accessToken,
      });
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    await authService.signOut();
    set({ accessToken: null, user: null });
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
    try {
      const newAccessToken = await authService.refresh();
      localStorage.setItem("accessToken", newAccessToken);
      set({ accessToken: newAccessToken });
    } catch (error) {
      console.error("Token refresh failed", error);
      get().clearState();
    }
  },
}));
