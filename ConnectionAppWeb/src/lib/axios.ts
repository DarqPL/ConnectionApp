import axios from "axios";
import { resolveApiBaseUrl } from "./apiConfig";

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  withCredentials: true,
});

// Request interceptor: attach JWT token
api.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem("accessToken");
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor: handle 401 and try refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isRefreshRequest =
      typeof originalRequest?.url === "string" &&
      originalRequest.url.includes("/auth/refresh");

    const isSigninRequest =
      typeof originalRequest?.url === "string" &&
      originalRequest.url.includes("/auth/signin");

    if (
      error.response?.status === 401 &&
      !originalRequest?._retry &&
      !isRefreshRequest &&
      !isSigninRequest
    ) {
      originalRequest._retry = true;

      try {
        const res = await api.post("/auth/refresh");
        const newAccessToken = res.data.accessToken;
        localStorage.setItem("accessToken", newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch {
        localStorage.removeItem("accessToken");
        window.location.href = "/signin";
      }
    }

    return Promise.reject(error);
  },
);

export default api;
