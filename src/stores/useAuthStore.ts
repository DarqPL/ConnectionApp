import { create } from "zustand";
// import { toast } from "sonner";
// import { authService } from "@/services/authService";
import type { AuthState } from "@/types/store";
// import { persist } from "zustand/middleware";
// import { useChatStore } from "./useChatStore";
import { MOCK_CURRENT_USER } from "@/data/mockChatData";

export const useAuthStore = create<AuthState>()(
  // persist(
  (set, get) => ({
    accessToken: "mock-access-token",
    // ✅ Khởi tạo bằng mock user
    user: MOCK_CURRENT_USER,
    loading: false,

    setAccessToken: (accessToken) => {
      set({ accessToken });
    },
    setUser: (user) => {
      set({ user });
    },
    clearState: () => {
      // ✅ Mock: reset về mock user thay vì null
      set({ accessToken: "mock-access-token", user: MOCK_CURRENT_USER, loading: false });
    },
    signUp: async (_username, _password, _email, _firstName, _lastName) => {
      // ✅ Mock: không gọi API
      console.log("Mock signUp called");
    },
    signIn: async (_username, _password) => {
      // ✅ Mock: không gọi API
      console.log("Mock signIn called");
      set({ user: MOCK_CURRENT_USER, accessToken: "mock-access-token" });
    },
    signOut: async () => {
      // ✅ Mock: không gọi API
      console.log("Mock signOut called");
    },
    fetchMe: async () => {
      // ✅ Mock: dùng mock user
      set({ user: MOCK_CURRENT_USER });
    },
    refresh: async () => {
      // ✅ Mock: không gọi API
      console.log("Mock refresh called");
    },
  }),
  // {
  //   name: "auth-storage",
  //   partialize: (state) => ({ user: state.user }),
  // }
  // )
);
