import axios from "axios";
import api from "@/lib/axios";
import { resolveApiBaseUrl } from "@/lib/apiConfig";

const publicApi = axios.create({
  baseURL: resolveApiBaseUrl(),
  withCredentials: true,
});

export const authService = {
  signUp: async (
    username: string,
    password: string,
    email: string,
    firstName: string,
    lastName: string,
  ) => {
    const res = await api.post("/auth/signup", {
      username,
      password,
      email,
      firstName,
      lastName,
    });
    return res.data;
  },

  sendSignupOtp: async (email: string, username?: string) => {
    const body: Record<string, string> = { email };
    if (username && username.trim()) body.username = username;
    const res = await api.post("/auth/signup/send-otp", body);
    return res.data;
  },

  signIn: async (username: string, password: string) => {
    const res = await api.post("/auth/signin", {
      username,
      password,
      platform: "WEB",
    });
    return res.data;
  },

  signOut: async () => {
    await api.post("/auth/logout");
    localStorage.removeItem("accessToken");
  },

  fetchMe: async () => {
    const res = await api.get("/users/profile");
    return res.data;
  },

  refresh: async () => {
    const res = await api.post("/auth/refresh");
    return res.data.accessToken;
  },

  forgotPassword: async (email: string) => {
    const res = await api.post("/auth/forgot-password", { email });
    return res.data;
  },

  verifyOtp: async (email: string, otp: string) => {
    const res = await api.post("/auth/verify-otp", { email, otp });
    return res.data;
  },

  resetPassword: async (email: string, otp: string, newPassword: string) => {
    const res = await api.post("/auth/reset-password", {
      email,
      otp,
      newPassword,
    });
    return res.data;
  },

  requestManualUnlockOtp: async (usernameOrEmail: string, email: string) => {
    const res = await publicApi.post("/auth/manual-lock/request-otp", {
      usernameOrEmail,
      email,
    });
    return res.data;
  },

  verifyManualUnlockOtp: async (
    usernameOrEmail: string,
    email: string,
    otp: string,
  ) => {
    const res = await publicApi.post("/auth/manual-lock/verify-otp", {
      usernameOrEmail,
      email,
      otp,
    });
    return res.data;
  },
};
